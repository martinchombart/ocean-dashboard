// ─────────────────────────────────────────────────────────────
// dataLoader.js — load data + bilinear upsampling for smooth gradients
// ─────────────────────────────────────────────────────────────

const _cache = new Map()

export async function loadData(variable, year, season) {
  const { VARIABLES } = await import('./config.js')
  const meta = VARIABLES[variable]
  const url  = `/data/${variable}/${meta.filePrefix}_${year}_${season}.json`
  if (_cache.has(url)) return _cache.get(url)
  try {
    const res = await fetch(url)
    if (!res.ok) { _cache.set(url, null); return null }
    const data = await res.json()
    _cache.set(url, data)
    return data
  } catch { _cache.set(url, null); return null }
}

// ── Bilinear upsampling 1° → 0.5° ────────────────────────────
// Source data centres sit at x.5° (−179.5 … 179.5).
// Each output 0.5° cell gets a value bilinearly interpolated from its
// four surrounding 1° neighbours → colours fade smoothly between data points.
// At globe zoom each 0.5° cell ≈ 2 px, boundaries invisible.

const STEP = 0.5

function _key(lo, la) { return `${+lo.toFixed(1)},${+la.toFixed(1)}` }

function _bilinear(grid, lon, lat) {
  // Find the four surrounding 1° grid centres (data sits at x.5 degrees)
  // lf = west centre, lf+1 = east centre
  // ls = south centre, ls+1 = north centre
  const lf = Math.floor(lon - 0.5) + 0.5   // west 1° centre
  const ls = Math.floor(lat - 0.5) + 0.5   // south 1° centre

  // Fractional position inside the 1° cell (0→west/south, 1→east/north)
  const tx = lon - lf   // 0 = at west centre, 1 = at east centre
  const ty = lat - ls   // 0 = at south centre, 1 = at north centre

  const vSW = grid.get(_key(lf,   ls  ))   // south-west
  const vSE = grid.get(_key(lf+1, ls  ))   // south-east
  const vNW = grid.get(_key(lf,   ls+1))   // north-west
  const vNE = grid.get(_key(lf+1, ls+1))   // north-east

  const defined = [vSW, vSE, vNW, vNE].filter(v => v !== undefined)
  if (!defined.length) return undefined
  const fb = defined.reduce((a, b) => a + b, 0) / defined.length

  // Standard bilinear: blend east↔west, then south↔north
  const south = (vSW ?? fb) * (1 - tx) + (vSE ?? fb) * tx
  const north = (vNW ?? fb) * (1 - tx) + (vNE ?? fb) * tx
  return south * (1 - ty) + north * ty
}

function _cell(lon, lat) {
  const h = STEP / 2
  return { type:'Polygon', coordinates:[[
    [lon-h,lat-h],[lon+h,lat-h],[lon+h,lat+h],[lon-h,lat+h],[lon-h,lat-h]
  ]]}
}

function _upsample(rawGrid, dMin, dMax) {
  const range = dMax - dMin || 1
  const h = STEP / 2
  const features = []
  for (let lat = -90+h; lat < 90; lat += STEP) {
    const latR = Math.round(lat * 2) / 2
    for (let lon = -180+h; lon < 180; lon += STEP) {
      const lonR = Math.round(lon * 2) / 2
      const v = _bilinear(rawGrid, lonR, latR)
      if (v === undefined) continue
      features.push({
        type:'Feature', geometry:_cell(lonR,latR),
        properties:{
          value:      v,
          value_norm: Math.max(0,Math.min(1,(v-dMin)/range)),
        },
      })
    }
  }
  return { type:'FeatureCollection', features }
}

export function toGeoJSON(dataObj, domain) {
  if (!dataObj?.points) return emptyFC()
  const g = new Map()
  for (const p of dataObj.points) g.set(_key(p.lon,p.lat), p.v)
  return _upsample(g, domain[0], domain[1])
}

export function toDiffGeoJSON(dataB, dataA, diffRange) {
  if (!dataB?.points || !dataA?.points) return emptyFC()
  const mapA = new Map(dataA.points.map(p => [_key(p.lon,p.lat), p.v]))
  const g = new Map()
  for (const p of dataB.points) {
    const ref = mapA.get(_key(p.lon,p.lat))
    if (ref !== undefined) g.set(_key(p.lon,p.lat), p.v - ref)
  }
  return _upsample(g, diffRange[0], diffRange[1])
}

export const emptyFC = () => ({ type:'FeatureCollection', features:[] })
