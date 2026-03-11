// ─────────────────────────────────────────────────────────────
// dataLoader.js  —  Load + cache JSON data, build GeoJSON
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
  } catch {
    _cache.set(url, null)
    return null
  }
}

/** Convert raw {points:[{lon,lat,v}]} to Mapbox GeoJSON with value_norm 0–1 */
export function toGeoJSON(dataObj, domain) {
  if (!dataObj?.points) return emptyFC()
  const [dMin, dMax] = domain
  const range = dMax - dMin || 1
  return {
    type: 'FeatureCollection',
    features: dataObj.points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        value:      p.v,
        value_norm: Math.max(0, Math.min(1, (p.v - dMin) / range)),
      },
    })),
  }
}

/** Build signed-difference GeoJSON for Compare mode */
export function toDiffGeoJSON(dataB, dataA, diffRange) {
  if (!dataB?.points || !dataA?.points) return emptyFC()
  const [dMin, dMax] = diffRange
  const range = dMax - dMin || 1

  const mapA = new Map(dataA.points.map(p => [`${p.lon},${p.lat}`, p.v]))

  const features = []
  for (const p of dataB.points) {
    const ref = mapA.get(`${p.lon},${p.lat}`)
    if (ref === undefined) continue
    const diff = p.v - ref
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: {
        value:      diff,
        value_norm: Math.max(0, Math.min(1, (diff - dMin) / range)),
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

export const emptyFC = () => ({ type: 'FeatureCollection', features: [] })
