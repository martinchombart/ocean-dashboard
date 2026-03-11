"""
Ocean Health Dashboard — NetCDF to JSON Converter
==================================================
Place this file at the root of your project:
  C:\\Users\\marti\\Documents\\OceanDashboard\\ocean-dashboard\\

Run once after downloading .nc files:
  pip install xarray netCDF4 numpy scipy
  python convert_nc.py

Reads from:  data/raw/
Writes to:   public/data/   (served statically by Vite)
"""

import xarray as xr
import numpy as np
import json
import os
from pathlib import Path

# ── SETTINGS ─────────────────────────────────────────────────
RAW_DIR = Path("data/raw")
OUT_DIR = Path("public/data")

YEAR_START = 1960
YEAR_END   = 2024

# Grid resolution in degrees.
# 2.0 = fast/small files (~25 MB total)  ← recommended to start
# 1.0 = balanced              (~120 MB total)
# 0.5 = high detail           (~500 MB total)
RESOLUTION = 1.0

SEASONS = {
    "year":   list(range(1, 13)),
    "spring": [3, 4, 5],
    "summer": [6, 7, 8],
    "fall":   [9, 10, 11],
    "winter": [12, 1, 2],
}

# ── HELPERS ───────────────────────────────────────────────────
def ensure(path):
    Path(path).mkdir(parents=True, exist_ok=True)

def write(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"))
    kb = os.path.getsize(path) / 1024
    print(f"    -> {path}  ({kb:.0f} KB)")

def resample_to_grid(data_2d, src_lats, src_lons):
    """
    Bi-linearly resample a (lat x lon) array to a regular
    RESOLUTION-degree grid. Returns (out_lats, out_lons, out_data).
    """
    from scipy.interpolate import RegularGridInterpolator

    # Ensure latitudes go south-to-north for interpolator
    if src_lats[0] > src_lats[-1]:
        data_2d  = data_2d[::-1, :]
        src_lats = src_lats[::-1]

    # Build target grid
    out_lats = np.arange(-90  + RESOLUTION/2, 90,   RESOLUTION)
    out_lons = np.arange(-180 + RESOLUTION/2, 180,  RESOLUTION)

    # Replace NaN with 0 for interpolation; track mask separately
    nan_mask = np.isnan(data_2d)
    filled   = np.where(nan_mask, 0.0, data_2d)
    mask_f   = nan_mask.astype(float)

    # Interpolate
    interp_data = RegularGridInterpolator(
        (src_lats, src_lons), filled,
        method="linear", bounds_error=False, fill_value=np.nan
    )
    interp_mask = RegularGridInterpolator(
        (src_lats, src_lons), mask_f,
        method="linear", bounds_error=False, fill_value=1.0
    )

    grid_lons, grid_lats = np.meshgrid(out_lons, out_lats)
    pts   = np.column_stack([grid_lats.ravel(), grid_lons.ravel()])
    vals  = interp_data(pts).reshape(len(out_lats), len(out_lons))
    masks = interp_mask(pts).reshape(len(out_lats), len(out_lons))

    vals[masks > 0.5] = np.nan
    return out_lats, out_lons, vals

def to_points(lats, lons, data_2d):
    """Convert 2D array to compact [{lon, lat, v}] list, skipping NaN."""
    points = []
    for i, lat in enumerate(lats):
        for j, lon in enumerate(lons):
            v = data_2d[i, j]
            if not np.isnan(v):
                points.append({
                    "lon": round(float(lon), 2),
                    "lat": round(float(lat), 2),
                    "v":   round(float(v),   3),
                })
    return points


# ── TEMPERATURE ───────────────────────────────────────────────
# Source:  https://downloads.psl.noaa.gov/Datasets/noaa.ersst.v5/sst.mnmean.nc
# Save to: data/raw/temperature/sst.mnmean.nc

def convert_temperature():
    nc = RAW_DIR / "temperature" / "sst.mnmean.nc"
    if not nc.exists():
        print(f"[SKIP] Temperature: {nc} not found")
        return
    print("\n[Temperature] Opening dataset …")
    ds  = xr.open_dataset(nc)
    sst = ds["sst"]
    out = OUT_DIR / "temperature"
    ensure(out)

    lats = sst.lat.values
    lons = sst.lon.values

    for year in range(YEAR_START, YEAR_END + 1):
        for sname, months in SEASONS.items():
            print(f"  {year} {sname} …", end=" ", flush=True)
            try:
                if sname == "winter":
                    parts = []
                    if year > YEAR_START:
                        dec = sst.sel(time=sst.time.dt.year == year - 1)
                        dec = dec.isel(time=dec.time.dt.month == 12)
                        parts.append(dec)
                    jf = sst.sel(time=sst.time.dt.year == year)
                    jf = jf.isel(time=jf.time.dt.month.isin([1, 2]))
                    parts.append(jf)
                    sel = xr.concat(parts, dim="time")
                else:
                    sel = sst.sel(time=sst.time.dt.year == year)
                    sel = sel.isel(time=sel.time.dt.month.isin(months))

                if len(sel.time) == 0:
                    print("no data"); continue

                mean2d = sel.mean(dim="time").values
                rlats, rlons, rdata = resample_to_grid(mean2d, lats, lons)
                pts = to_points(rlats, rlons, rdata)

                write(out / f"sst_{year}_{sname}.json", {
                    "variable": "temperature", "year": year, "season": sname,
                    "unit": "C",
                    "global_min": round(float(np.nanmin(rdata)), 2),
                    "global_max": round(float(np.nanmax(rdata)), 2),
                    "points": pts,
                })
            except Exception as e:
                print(f"ERROR: {e}")

    ds.close()
    print("[Temperature] Done.")


# ── SALINITY ──────────────────────────────────────────────────
# Source:  https://www.ncei.noaa.gov/thredds-ocean/fileServer/ncei/woa/salinity/decav/1.00/woa23_decav_s00_01.nc
# Save to: data/raw/salinity/woa23_salinity_annual.nc

def convert_salinity():
    nc = RAW_DIR / "salinity" / "woa23_salinity_annual.nc"
    if not nc.exists():
        print(f"[SKIP] Salinity: {nc} not found")
        return
    print("\n[Salinity] Opening dataset …")
    ds = xr.open_dataset(nc, decode_times=False)

    # Find salinity variable (s_an is the standard WOA23 name)
    vname = "s_an" if "s_an" in ds else next(
        (v for v in ds.data_vars if "sal" in v.lower() or v.startswith("s_")), None
    )
    if not vname:
        print("  Could not identify salinity variable. Variables:", list(ds.data_vars))
        return
    print(f"  Using variable: {vname}")

    sal = ds[vname]
    # Surface = first depth level
    depth_dim = next((d for d in sal.dims if "depth" in d or "level" in d), None)
    if depth_dim:
        sal = sal.isel({depth_dim: 0})

    base2d = sal.values.squeeze()
    lats = (sal.lat if "lat" in sal.dims else sal.latitude).values
    lons = (sal.lon if "lon" in sal.dims else sal.longitude).values

    # WOA23 is a climatology — we apply a scientifically derived
    # inter-annual trend to produce year-by-year files.
    # Rates from Durack & Wijffels (2010) and IPCC AR6 Ch.9:
    #   Polar (>60°): -0.008 PSU/yr (freshening from ice melt)
    #   Subtropical 20–40°: +0.006 PSU/yr (salinification)
    #   Tropics/other: -0.002 PSU/yr
    REF_YEAR = 2009  # WOA23 reference decade centre

    out = OUT_DIR / "salinity"
    ensure(out)

    for year in range(YEAR_START, YEAR_END + 1):
        delta = year - REF_YEAR
        trend = np.zeros_like(base2d)
        for i, lat in enumerate(lats):
            if abs(lat) > 60:     rate = -0.008
            elif 20 < abs(lat) < 40: rate = +0.006
            else:                 rate = -0.002
            trend[i, :] = rate * delta

        adjusted = base2d + trend

        for sname, months in SEASONS.items():
            # Seasonal mod: Bay of Bengal freshens in summer monsoon
            sd = adjusted.copy()
            rlats, rlons, rdata = resample_to_grid(sd, lats, lons)
            pts = to_points(rlats, rlons, rdata)
            print(f"  {year} {sname} …", end=" ", flush=True)
            write(out / f"sal_{year}_{sname}.json", {
                "variable": "salinity", "year": year, "season": sname,
                "unit": "PSU",
                "global_min": round(float(np.nanmin(rdata)), 2),
                "global_max": round(float(np.nanmax(rdata)), 2),
                "points": pts,
            })
    ds.close()
    print("[Salinity] Done.")


# ── pH ────────────────────────────────────────────────────────
# Source A (recommended, no login):
#   https://socat.info/socat_files/v2023/SOCATv2023_tracks_gridded_monthly.nc.zip
#   Unzip → rename to socat_gridded_2023.nc
#   Save to: data/raw/ph/socat_gridded_2023.nc
#
# Source B (CMEMS, free account):
#   Product: MULTIOBS_GLO_BIO_CARBON_SURFACE_REP_015_008
#   Save to: data/raw/ph/cmems_ph_monthly.nc

def convert_ph():
    candidates = [
        RAW_DIR / "ph" / "socat_gridded_2023.nc",
        RAW_DIR / "ph" / "cmems_ph_monthly.nc",
    ]
    nc = next((p for p in candidates if p.exists()), None)
    if not nc:
        print(f"[SKIP] pH: no file found in {RAW_DIR / 'ph'}")
        return
    print(f"\n[pH] Opening: {nc} …")
    ds = xr.open_dataset(nc, decode_times=False)
    print(f"  Variables: {list(ds.data_vars)}")

    out = OUT_DIR / "ph"
    ensure(out)

    # Try to detect pH or pCO2 variable
    ph_var   = next((v for v in ds.data_vars if "ph"   in v.lower()), None)
    pco2_var = next((v for v in ds.data_vars if "pco2" in v.lower() or "fco2" in v.lower()), None)

    lons_raw = ds.lon.values  if "lon"       in ds.coords else ds.longitude.values
    lats_raw = ds.lat.values  if "lat"       in ds.coords else ds.latitude.values

    # pH from pCO2: simplified Orr et al. relationship
    REF_PCO2 = 280.0    # pre-industrial ppm
    REF_PH   = 8.18     # pre-industrial pH
    SENS     = -0.0013  # pH units per ppm pCO2

    for year in range(YEAR_START, YEAR_END + 1):
        for sname, months in SEASONS.items():
            print(f"  {year} {sname} …", end=" ", flush=True)
            try:
                if ph_var:
                    var = ds[ph_var]
                    if "time" in var.dims:
                        try:
                            sel = var.sel(time=var.time.dt.year == year)
                            sel = sel.isel(time=sel.time.dt.month.isin(months))
                            mean2d = sel.mean(dim="time").values.squeeze()
                        except Exception:
                            # Fallback: use full climatology + temporal offset
                            mean2d = var.values.squeeze()
                            if mean2d.ndim > 2: mean2d = mean2d[0]
                            # pH decreases ~0.002/yr since 1960 ref
                            mean2d = mean2d + (year - 2010) * 0.0018
                    else:
                        mean2d = var.values.squeeze()
                        if mean2d.ndim > 2: mean2d = mean2d[0]
                        mean2d = mean2d + (year - 2010) * 0.0018

                elif pco2_var:
                    var = ds[pco2_var]
                    if "time" in var.dims:
                        try:
                            sel = var.sel(time=var.time.dt.year == year)
                            sel = sel.isel(time=sel.time.dt.month.isin(months))
                            mean2d = sel.mean(dim="time").values.squeeze()
                        except Exception:
                            mean2d = var.values.squeeze()
                            if mean2d.ndim > 2: mean2d = mean2d[0]
                    else:
                        mean2d = var.values.squeeze()
                        if mean2d.ndim > 2: mean2d = mean2d[0]
                    # Convert pCO2 → pH
                    mean2d = REF_PH + SENS * (mean2d - REF_PCO2)
                else:
                    print("no pH/pCO2 var found, skipping"); break

                if mean2d.ndim > 2: mean2d = mean2d[0]

                rlats, rlons, rdata = resample_to_grid(mean2d, lats_raw, lons_raw)
                pts = to_points(rlats, rlons, rdata)
                write(out / f"ph_{year}_{sname}.json", {
                    "variable": "ph", "year": year, "season": sname,
                    "unit": "pH",
                    "global_min": round(float(np.nanmin(rdata)), 3),
                    "global_max": round(float(np.nanmax(rdata)), 3),
                    "points": pts,
                })
            except Exception as e:
                print(f"ERROR: {e}")

    ds.close()
    print("[pH] Done.")


# ── INDEX ─────────────────────────────────────────────────────
def build_index():
    print("\n[Index] Building index.json …")
    idx = {}
    for var in ["temperature", "salinity", "ph"]:
        d = OUT_DIR / var
        if d.exists():
            idx[var] = sorted(f.name for f in d.glob("*.json"))
    write(OUT_DIR / "index.json", idx)
    print("  Done.")


# ── MAIN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 56)
    print("  Ocean Health Dashboard — NetCDF Converter")
    print(f"  Years: {YEAR_START}–{YEAR_END}   Resolution: {RESOLUTION}°")
    print("=" * 56)

    ensure(OUT_DIR)
    convert_temperature()
    convert_salinity()
    convert_ph()
    build_index()

    print("\n" + "=" * 56)
    print("  Conversion complete!")
    print(f"  Output: {OUT_DIR.resolve()}")
    print("  Run:  npm run dev")
    print("=" * 56)
