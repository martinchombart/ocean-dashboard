"""
Ocean Health Dashboard — CMEMS Live Fetcher
===========================================
Interroge l'API CMEMS directement. Aucun fichier .nc stocké localement.
Sortie : public/data/{variable}/{prefix}_{year}_{season}.json

── SETUP (une fois) ──────────────────────────────────────────────────
    pip install copernicusmarine xarray numpy scipy
    copernicusmarine login          # stocke les credentials localement

── USAGE ─────────────────────────────────────────────────────────────
    python convert_nc.py                     # tous les fichiers manquants
    python convert_nc.py --only-new          # seulement les mois récents (cron)
    python convert_nc.py --var temperature   # une seule variable
    python convert_nc.py --probe             # inspecte les datasets CMEMS
    python convert_nc.py --probe --var ph    # inspecte un dataset précis

── CI / GITHUB ACTIONS ───────────────────────────────────────────────
    Variables d'environnement attendues :
        COPERNICUSMARINE_SERVICE_USERNAME
        COPERNICUSMARINE_SERVICE_PASSWORD
"""

import os, json, argparse, sys
from pathlib import Path
from datetime import datetime
import numpy as np
from scipy.interpolate import RegularGridInterpolator

# ─── CONFIG ──────────────────────────────────────────────────────────

OUT_DIR    = Path("public/data")
RESOLUTION = 1.0                        # résolution de sortie en degrés
YEAR_END   = datetime.now().year        # automatiquement à jour

SEASONS = {
    "year":   list(range(1, 13)),
    "spring": [3, 4, 5],
    "summer": [6, 7, 8],
    "fall":   [9, 10, 11],
    "winter": [12, 1, 2],
}

# ─── DATASETS CMEMS ──────────────────────────────────────────────────
# IDs vérifiables sur : https://data.marine.copernicus.eu
# En cas d'erreur "dataset not found", lancer :
#   python convert_nc.py --probe --var <variable>

DATASETS = {
    "temperature": {
        "dataset_id":   "METOFFICE-GLO-SST-L4-REP-OBS-SST",
        "variable":     "analysed_sst",
        "prefix":       "sst",
        "unit":         "C",
        "year_min":     1982,       # OSTIA satellite depuis sept. 1981
        "depth_min":    None,       # pas de dimension depth (produit surface)
        "depth_max":    None,
        "unit_offset":  -273.15,    # Kelvin → Celsius
        "domain":       [-2, 32],
    },
    "salinity": {
        "dataset_id":   "cmems_mod_glo_phy_my_0.083deg_P1M-m",
        "variable":     "so",
        "prefix":       "sal",
        "unit":         "PSU",
        "year_min":     1993,       # GLORYS12 depuis 1993
        "depth_min":    0.0,
        "depth_max":    1.0,
        "unit_offset":  0,
        "domain":       [30, 40],
    },
    "ph": {
        "dataset_id":   "cmems_mod_glo_bgc_my_0.25deg_P1M-m",
        "variable":     "ph",
        "prefix":       "ph",
        "unit":         "pH",
        "year_min":     1993,       # modèle PISCES depuis 1993
        "depth_min":    0.0,
        "depth_max":    1.0,
        "unit_offset":  0,
        "domain":       [7.75, 8.25],
    },
}

# ─── HELPERS ─────────────────────────────────────────────────────────

def ensure(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def write_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    kb = os.path.getsize(path) / 1024
    print(f"    → {path}  ({kb:.0f} KB)")

def resample_to_grid(data_2d, src_lats, src_lons):
    """Rééchantillonne vers une grille régulière RESOLUTION°."""
    if src_lats[0] > src_lats[-1]:
        data_2d  = data_2d[::-1, :]
        src_lats = src_lats[::-1]

    if src_lons.max() > 180:
        split    = np.searchsorted(src_lons, 180)
        src_lons = np.concatenate([src_lons[split:] - 360, src_lons[:split]])
        data_2d  = np.concatenate([data_2d[:, split:], data_2d[:, :split]], axis=1)

    src_lons = np.append(src_lons, 180.0)
    data_2d  = np.concatenate([data_2d, data_2d[:, :1]], axis=1)

    out_lats = np.arange(-90  + RESOLUTION / 2, 90,  RESOLUTION)
    out_lons = np.arange(-180 + RESOLUTION / 2, 180, RESOLUTION)

    nan_mask = np.isnan(data_2d)
    filled   = np.where(nan_mask, 0.0, data_2d)
    mask_f   = nan_mask.astype(float)

    id_ = RegularGridInterpolator(
        (src_lats, src_lons), filled,
        method="linear", bounds_error=False, fill_value=np.nan,
    )
    im_ = RegularGridInterpolator(
        (src_lats, src_lons), mask_f,
        method="linear", bounds_error=False, fill_value=1.0,
    )

    gl, gla = np.meshgrid(out_lons, out_lats)
    pts     = np.column_stack([gla.ravel(), gl.ravel()])
    vals    = id_(pts).reshape(len(out_lats), len(out_lons))
    masks   = im_(pts).reshape(len(out_lats), len(out_lons))
    vals[masks > 0.5] = np.nan
    return out_lats, out_lons, vals

def to_points(lats, lons, data_2d):
    """Convertit un array 2D en liste [{lon, lat, v}] (sans NaN)."""
    pts = []
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            v = data_2d[i, j]
            if not np.isnan(v):
                pts.append({
                    "lon": round(float(lon), 2),
                    "lat": round(float(lat), 2),
                    "v":   round(float(v),   3),
                })
    return pts

def missing_files(var_name, cfg, year_start):
    """Retourne la liste des (year, season) dont le JSON est absent."""
    out  = OUT_DIR / var_name
    missing = []
    for year in range(year_start, YEAR_END + 1):
        for sname in SEASONS:
            p = out / f"{cfg['prefix']}_{year}_{sname}.json"
            if not p.exists():
                missing.append((year, sname))
    return missing

# ─── PROBE ───────────────────────────────────────────────────────────

def probe(var_name=None):
    """Inspecte les datasets CMEMS pour vérifier IDs et noms de variables."""
    import copernicusmarine
    targets = {var_name: DATASETS[var_name]} if var_name else DATASETS
    for name, cfg in targets.items():
        print(f"\n{'='*60}")
        print(f"  {name.upper()}  —  {cfg['dataset_id']}")
        print(f"{'='*60}")
        try:
            kwargs = dict(
                dataset_id=cfg["dataset_id"],
                variables=[cfg["variable"]],
                minimum_longitude=-5, maximum_longitude=5,
                minimum_latitude=-5,  maximum_latitude=5,
                start_datetime="2020-01-01",
                end_datetime="2020-03-01",
            )
            if cfg["depth_min"] is not None:
                kwargs["minimum_depth"] = cfg["depth_min"]
                kwargs["maximum_depth"] = cfg["depth_max"]

            ds = copernicusmarine.open_dataset(**kwargs)
            print(f"  ✓ Dataset accessible")
            print(f"  Variables : {list(ds.data_vars)}")
            print(f"  Coords    : {list(ds.coords)}")
            print(f"  Dims      : {dict(ds.dims)}")
            for vname in ds.data_vars:
                vr = ds[vname]
                print(f"  [{vname}] shape={vr.shape}  dtype={vr.dtype}")
            ds.close()
        except Exception as e:
            print(f"  ✗ Erreur : {e}")
            print(f"  → Vérifie l'ID sur https://data.marine.copernicus.eu")

# ─── CONVERSION ──────────────────────────────────────────────────────

def convert_variable(var_name, only_new=False):
    import copernicusmarine

    cfg        = DATASETS[var_name]
    year_start = cfg["year_min"]
    out        = OUT_DIR / var_name
    ensure(out)

    to_do = missing_files(var_name, cfg, year_start)
    if not to_do:
        print(f"  [{var_name}] Tout est déjà à jour.")
        return

    if only_new:
        # Garde seulement les fichiers des 2 dernières années
        cutoff = YEAR_END - 1
        to_do  = [(y, s) for y, s in to_do if y >= cutoff]
        if not to_do:
            print(f"  [{var_name}] Aucun nouveau fichier.")
            return

    years_needed = sorted(set(y for y, _ in to_do))
    print(f"\n[{var_name}] {len(to_do)} fichiers à générer "
          f"({years_needed[0]}–{years_needed[-1]})")

    # Ouvre le dataset lazily (rien téléchargé)
    print(f"  Connexion CMEMS …")
    try:
        kwargs = dict(
            dataset_id=cfg["dataset_id"],
            variables=[cfg["variable"]],
        )
        if cfg["depth_min"] is not None:
            kwargs["minimum_depth"] = cfg["depth_min"]
            kwargs["maximum_depth"] = cfg["depth_max"]

        ds = copernicusmarine.open_dataset(**kwargs)
    except Exception as e:
        print(f"  ✗ Impossible d'ouvrir le dataset : {e}")
        print(f"  → Lance : python convert_nc.py --probe --var {var_name}")
        return

    var = ds[cfg["variable"]]

    # Détecte les noms de coordonnées (lat/lon/time varient selon les datasets)
    lat_name  = next((c for c in ["latitude",  "lat"]  if c in ds.coords), None)
    lon_name  = next((c for c in ["longitude", "lon"]  if c in ds.coords), None)
    time_name = next((c for c in ["time", "valid_time"] if c in ds.coords), None)

    if not lat_name or not lon_name:
        print(f"  ✗ Coordonnées lat/lon introuvables : {list(ds.coords)}")
        ds.close(); return

    print(f"  Coords détectées : time={time_name}, lat={lat_name}, lon={lon_name}")

    # Filtre depth si présente
    if "depth" in var.dims and cfg["depth_min"] is not None:
        var = var.isel(depth=0)

    done = 0
    for year in years_needed:
        seasons_for_year = [s for y, s in to_do if y == year]

        try:
            # Sélectionne l'année (+ décembre précédent pour winter)
            months_needed = set()
            for sname in seasons_for_year:
                months_needed.update(SEASONS[sname])

            # Charge uniquement les mois nécessaires pour cette année
            if time_name:
                year_data = var.sel(
                    {time_name: var[time_name].dt.year.isin([year - 1, year])}
                )
            else:
                year_data = var

            for sname in seasons_for_year:
                months = SEASONS[sname]

                try:
                    if sname == "winter":
                        # Décembre année-1 + Jan/Fév année
                        dec = year_data.sel(
                            {time_name: (year_data[time_name].dt.year == year - 1) &
                                        (year_data[time_name].dt.month == 12)}
                        )
                        jf  = year_data.sel(
                            {time_name: (year_data[time_name].dt.year == year) &
                                        (year_data[time_name].dt.month.isin([1, 2]))}
                        )
                        import xarray as xr
                        sel = xr.concat([dec, jf], dim=time_name) if len(dec[time_name]) > 0 else jf
                    else:
                        sel = year_data.sel(
                            {time_name: (year_data[time_name].dt.year == year) &
                                        (year_data[time_name].dt.month.isin(months))}
                        )

                    if len(sel[time_name]) == 0:
                        print(f"  {year} {sname} … pas de données")
                        continue

                    mean2d = sel.mean(dim=time_name).values.squeeze()
                    if mean2d.ndim > 2:
                        mean2d = mean2d[0]

                    # Conversion d'unité si nécessaire (ex: K → °C)
                    offset = cfg.get("unit_offset", 0)
                    if offset:
                        mean2d = mean2d + offset

                    lats   = ds[lat_name].values
                    lons   = ds[lon_name].values

                    rlats, rlons, rdata = resample_to_grid(mean2d, lats, lons)
                    pts = to_points(rlats, rlons, rdata)

                    path = out / f"{cfg['prefix']}_{year}_{sname}.json"
                    write_json(path, {
                        "variable":   var_name,
                        "year":       year,
                        "season":     sname,
                        "unit":       cfg["unit"],
                        "source":     cfg["dataset_id"],
                        "global_min": round(float(np.nanmin(rdata)), 3),
                        "global_max": round(float(np.nanmax(rdata)), 3),
                        "points":     pts,
                    })
                    done += 1

                except Exception as e:
                    print(f"  {year} {sname} … ERREUR : {e}")

        except Exception as e:
            print(f"  {year} … ERREUR année : {e}")

    ds.close()
    print(f"[{var_name}] {done} fichiers générés.")

# ─── INDEX ───────────────────────────────────────────────────────────

def build_index():
    print("\n[Index] Mise à jour de index.json …")
    idx = {}
    for var in DATASETS:
        d = OUT_DIR / var
        if d.exists():
            idx[var] = sorted(f.name for f in d.glob("*.json"))
    write_json(OUT_DIR / "index.json", idx)

# ─── MAIN ────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="Ocean Dashboard — CMEMS fetcher")
    p.add_argument("--var",      choices=list(DATASETS), help="Une seule variable")
    p.add_argument("--only-new", action="store_true",    help="Seulement les données récentes (cron)")
    p.add_argument("--probe",    action="store_true",    help="Inspecte les datasets sans générer")
    args = p.parse_args()

    if args.probe:
        probe(args.var)
        return

    print("=" * 60)
    print("  Ocean Health Dashboard — CMEMS Fetcher")
    print(f"  Résolution : {RESOLUTION}°   Jusqu'à : {YEAR_END}")
    if args.only_new:
        print("  Mode : only-new (cron)")
    print("=" * 60)

    ensure(OUT_DIR)
    targets = [args.var] if args.var else list(DATASETS)
    for var in targets:
        convert_variable(var, only_new=args.only_new)

    build_index()
    print("\n✓ Terminé.")

if __name__ == "__main__":
    main()
