import mapboxgl    from 'mapbox-gl/dist/mapbox-gl.js'
import { feature } from 'topojson-client'
import landTopo    from 'world-atlas/land-50m.json'
import { MAPBOX_TOKEN, MAP_CONFIG, VARIABLES, YEAR_MIN, YEAR_MAX } from './config.js'
import { loadData } from './dataLoader.js'

const SRC_OCEAN   = 'ocean-img'
const L_OCEAN     = 'layer-ocean'
const SRC_LAND    = 'land-src'
const L_LAND      = 'layer-land-mask'
const SRC_PH_DOTS = 'ph-dots-src'
const L_PH_DOTS   = 'layer-ph-dots'

const CW = 1080, CH = 720  // canvas dimensions
const LAT_MAX = 89         // Near-pole coverage (true 90° is ∞ in Mercator)
// Mercator Y extent for ±LAT_MAX (Y = ln(tan(π/4 + lat/2)))
const Y_MAX = Math.log(Math.tan(Math.PI / 4 + LAT_MAX * Math.PI / 360))

let _land = feature(landTopo, landTopo.objects.land)
let _landMaskData = null

function _projectXY(lon, lat) {
  const x = (lon + 180) / 360 * CW
  const yMerc = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))
  const y = (Y_MAX - yMerc) / (2 * Y_MAX) * CH
  return [x, y]
}

function _buildLandMask(geoData) {
  const c = document.createElement('canvas')
  c.width = CW; c.height = CH
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  const drawPoly = rings => {
    ctx.beginPath()
    for (const ring of rings) {
      ring.forEach(([lon, lat], i) => {
        const [x, y] = _projectXY(lon, lat)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.closePath()
    }
    ctx.fill('evenodd')
  }
  const features = geoData.type === 'FeatureCollection' ? geoData.features
                 : geoData.type === 'Feature'           ? [geoData]
                 : [{ geometry: geoData }]
  for (const feat of features) {
    const g = feat.geometry || feat
    if      (g.type === 'Polygon')      drawPoly(g.coordinates)
    else if (g.type === 'MultiPolygon') g.coordinates.forEach(drawPoly)
  }
  _landMaskData = ctx.getImageData(0, 0, CW, CH).data
}

_buildLandMask(_land)

fetch('/data/ne_10m_land.geojson')
  .then(r => r.ok ? r.json() : null)
  .then(d => { if (d) { _land = d; _buildLandMask(d); map?.getSource(SRC_LAND)?.setData(d); if (_ready) loadAndRender() } })
  .catch(() => {})

let map
let _oceanCanvas = null
const _pixelCache = new Map()   // "variable:season:year" → Uint8ClampedArray

let _ready       = false
let _initialLoad = true
let _renderSeq   = 0
let _variable = 'temperature'
let _season   = 'year'
let _year     = 2024
let _compare  = false
let _yearA    = 1990
let _yearB    = 2024
let _onCursor  = null
let _onLoading = null
let _grid      = null

const _FOG_GLOBE = {
  'range':           [0.5, 10],
  'color':           '#082f49',
  'high-color':      '#00060f',
  'space-color':     '#000008',
  'horizon-blend':   0.04,
  'star-intensity':  0.25,
}

export function initMap(containerId) {
  mapboxgl.accessToken = MAPBOX_TOKEN
  map = new mapboxgl.Map({
    container: containerId, style: MAP_CONFIG.style,
    center: MAP_CONFIG.center, zoom: MAP_CONFIG.zoom,
    minZoom: MAP_CONFIG.minZoom, maxZoom: MAP_CONFIG.maxZoom,
    projection: MAP_CONFIG.projection, attributionControl: true,
  })
  map.on('load', () => {
    try { _styleMap()  } catch(_){}
    try { _addLayers() } catch(e){ console.error('[map]', e) }
    map.setFog(_FOG_GLOBE)
    _bindCursor()
    _ready = true
    loadAndRender()
  })
  return map
}

function _addLayers() {
  const sym = map.getStyle().layers.find(l => l.type === 'symbol')?.id

  map.addSource('mapbox-dem', {
    type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    tileSize: 512, maxzoom: 14,
  })

  // 1. Ocean canvas source — drawn directly, no PNG encoding needed
  _oceanCanvas = document.createElement('canvas')
  _oceanCanvas.width = CW; _oceanCanvas.height = CH

  map.addSource(SRC_OCEAN, {
    type: 'canvas', canvas: _oceanCanvas, animate: true,
    coordinates: [[-180, LAT_MAX], [180, LAT_MAX], [180, -LAT_MAX], [-180, -LAT_MAX]],
  })
  map.addLayer({
    id: L_OCEAN, type: 'raster', source: SRC_OCEAN,
    paint: { 'raster-opacity': 0.95, 'raster-resampling': 'linear' },
  }, sym)

  // 2. Land fill — opaque, sharp coastline edges
  map.addSource(SRC_LAND, { type: 'geojson', data: _land })
  map.addLayer({
    id: L_LAND, type: 'fill', source: SRC_LAND,
    paint: { 'fill-color': '#6b7280', 'fill-antialias': true },
  }, sym)

  // 3. Hillshade above land fill → terrain relief on land, no effect over flat ocean
  map.addLayer({
    id: 'hillshading', type: 'hillshade', source: 'mapbox-dem',
    paint: {
      'hillshade-exaggeration': 0.8,
      'hillshade-shadow-color': '#3d4d5e',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-illumination-direction': 335,
      'hillshade-illumination-anchor': 'map',
    },
  }, sym)

  // 4. pH dots — raw data points, no gap-fill (hidden by default)
  map.addSource(SRC_PH_DOTS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: L_PH_DOTS, type: 'circle', source: SRC_PH_DOTS,
    layout: { visibility: 'none' },
    paint: {
      'circle-radius':       ['interpolate', ['linear'], ['zoom'], 1, 1.5, 3, 2.5, 6, 5, 9, 10],
      'circle-opacity':      0.85,
      'circle-stroke-width': 0,
      'circle-color': ['interpolate', ['linear'], ['get', 'v'],
        7.75, '#a01414',
        7.90, '#d25a0f',
        7.98, '#c8be28',
        8.08, '#50b450',
        8.18, '#3c78d2',
        8.25, '#5037b4',
      ],
    },
  }, sym)

  // 5. Move admin boundaries and country labels above hillshade
  map.getStyle().layers.forEach(({ id }) => {
    if (id.includes('admin') || id.includes('country-label'))
      try { map.moveLayer(id) } catch(_){}
  })
}

function _styleMap() {
  map.getStyle().layers.forEach(({ id, type }) => {
    try {
      if (type === 'background') { map.setPaintProperty(id,'background-color','#001e3c'); return }
      if (type === 'fill') {
        if (['land','landuse','park','airport','pitch','snow','glacier','sand','scrub','wood','grass','crop','building','national','residential'].some(k=>id.includes(k)))
          map.setPaintProperty(id,'fill-color','#6b7280')
        else if (id==='water'||id.includes('water'))
          map.setPaintProperty(id,'fill-color','#00060f')
      }
      if (type === 'line') {
        if (['road','bridge','tunnel','rail','ferry'].some(k=>id.includes(k)))
          map.setLayoutProperty(id,'visibility','none')
        else if (id.includes('admin-0-boundary')&&!id.includes('disputed'))
          { map.setPaintProperty(id,'line-color','rgba(255,255,255,0.45)'); map.setPaintProperty(id,'line-width',0.75) }
        else if (id.includes('admin-1'))
          map.setPaintProperty(id,'line-color','rgba(255,255,255,0.15)')
      }
      if (type==='symbol'&&id.includes('country-label'))
        { map.setPaintProperty(id,'text-color','rgba(255,255,255,0.8)'); map.setPaintProperty(id,'text-halo-color','rgba(0,0,0,0.9)') }
    } catch(_){}
  })
}

function _hex(h) { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)] }
function _lerpRGB(norm, stops, dMin, dMax) {
  const range=dMax-dMin||1
  const ns=stops.map(([v,c])=>[Math.max(0,Math.min(1,(v-dMin)/range)),_hex(c)])
  if (norm<=ns[0][0]) return ns[0][1]
  if (norm>=ns[ns.length-1][0]) return ns[ns.length-1][1]
  for (let i=0;i<ns.length-1;i++){
    const [n0,c0]=ns[i],[n1,c1]=ns[i+1]
    if (norm>=n0&&norm<=n1){
      const t=(norm-n0)/(n1-n0)
      return [Math.round(c0[0]+(c1[0]-c0[0])*t),Math.round(c0[1]+(c1[1]-c0[1])*t),Math.round(c0[2]+(c1[2]-c0[2])*t)]
    }
  }
  return ns[ns.length-1][1]
}
function _buildGrid(points, dMin, dMax) {
  const range = dMax - dMin || 1
  const g = new Map()
  for (const p of points)
    g.set(`${p.lon},${p.lat}`, { v: p.v, norm: Math.max(0, Math.min(1, (p.v-dMin)/range)) })
  return _fillGaps(g)
}

// Raw grid without BFS gap-filling — only actual data points
function _buildGridRaw(points, dMin, dMax) {
  const range = dMax - dMin || 1
  const g = new Map()
  for (const p of points)
    g.set(`${p.lon},${p.lat}`, { v: p.v, norm: Math.max(0, Math.min(1, (p.v-dMin)/range)) })
  return g
}

// BFS multi-source: spread nearest-ocean values to cells with no data (ice, gaps)
// O(n) — runs in < 5 ms on the 360×180 global grid
function _fillGaps(grid) {
  const filled  = new Map(grid)
  const visited = new Set(grid.keys())
  const queue   = [...grid.entries()].map(([key, val]) => ({ key, val }))
  let head = 0

  const dirs = [[-1,0],[1,0],[0,-1],[0,1]]

  while (head < queue.length) {
    const { key, val } = queue[head++]
    const comma = key.indexOf(',')
    const lon = parseFloat(key.slice(0, comma))
    const lat = parseFloat(key.slice(comma + 1))

    for (const [dLon, dLat] of dirs) {
      const nLon = +(lon + dLon).toFixed(1)
      const nLat = +(lat + dLat).toFixed(1)
      if (nLon < -179.5 || nLon > 179.5 || nLat < -89.5 || nLat > 89.5) continue
      const nKey = `${nLon},${nLat}`
      if (!visited.has(nKey)) {
        visited.add(nKey)
        filled.set(nKey, val)
        queue.push({ key: nKey, val })
      }
    }
  }
  return filled
}
function _key(lo, la) { return `${+lo.toFixed(1)},${+la.toFixed(1)}` }

function _bilinear(grid, lon, lat) {
  const lf = Math.floor(lon - 0.5) + 0.5
  const ls = Math.floor(lat - 0.5) + 0.5
  const tx = lon - lf, ty = lat - ls
  const vSW = grid.get(_key(lf,   ls  ))?.norm
  const vSE = grid.get(_key(lf+1, ls  ))?.norm
  const vNW = grid.get(_key(lf,   ls+1))?.norm
  const vNE = grid.get(_key(lf+1, ls+1))?.norm
  const vals = [vSW,vSE,vNW,vNE].filter(v=>v!==undefined)
  if (!vals.length) return undefined
  const fb = vals.reduce((a,b)=>a+b,0)/vals.length
  const south = (vSW??fb)*(1-tx) + (vSE??fb)*tx
  const north = (vNW??fb)*(1-tx) + (vNE??fb)*tx
  return south*(1-ty) + north*ty
}

function _renderToPixels(grid, colorStops, dMin, dMax) {
  const px = new Uint8ClampedArray(CW * CH * 4)
  for (let y = 0; y < CH; y++) {
    // Mercator Y → lat (Mapbox uses Mercator internally for canvas/image sources)
    const yMerc = Y_MAX - y * (2 * Y_MAX) / (CH - 1)
    const lat   = (2 * Math.atan(Math.exp(yMerc)) - Math.PI / 2) * 180 / Math.PI
    for (let x = 0; x < CW; x++) {
      const lon  = -180 + (x / (CW - 1)) * 360
      const norm = _bilinear(grid, lon, lat)
      if (norm === undefined) continue
      const [r,g,b] = _lerpRGB(norm, colorStops, dMin, dMax)
      const i = (y*CW+x)*4; px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=242
    }
  }
  return px
}

function _applyPixels(px) {
  const ctx = _oceanCanvas.getContext('2d')
  const img = ctx.createImageData(CW, CH)
  img.data.set(px)
  ctx.putImageData(img, 0, 0)
}

function _blendPixels(pxA, pxB, t) {
  const t1 = 1 - t
  const out = new Uint8ClampedArray(pxA.length)
  for (let i = 0; i < pxA.length; i += 4) {
    const aA = pxA[i+3], aB = pxB[i+3]
    if (aA === 0 && aB === 0) continue
    if (aA === 0) { out[i]=pxB[i]; out[i+1]=pxB[i+1]; out[i+2]=pxB[i+2]; out[i+3]=aB; continue }
    if (aB === 0) { out[i]=pxA[i]; out[i+1]=pxA[i+1]; out[i+2]=pxA[i+2]; out[i+3]=aA; continue }
    out[i]   = (t1*pxA[i]   + t*pxB[i]   + 0.5) | 0
    out[i+1] = (t1*pxA[i+1] + t*pxB[i+1] + 0.5) | 0
    out[i+2] = (t1*pxA[i+2] + t*pxB[i+2] + 0.5) | 0
    out[i+3] = 242
  }
  return out
}

function _bindCursor() {
  map.on('mousemove', e => {
    if (!_onCursor || !_grid) { _onCursor?.(null, null, e.lngLat.lng, e.lngLat.lat, false); return }

    // Hide when over land — uses the actual ne_10m vector layer for pixel-perfect coastlines
    if (map.queryRenderedFeatures(e.point, { layers: [L_LAND] }).length > 0) {
      _onCursor(null, null, e.lngLat.lng, e.lngLat.lat, false); return
    }

    // Nearest 1° data centre (data sits at x.5°: −179.5 … 179.5)
    const lo = Math.max(-179.5, Math.min(179.5, Math.round(e.lngLat.lng - 0.5) + 0.5))
    const la = Math.max( -89.5, Math.min(  89.5, Math.round(e.lngLat.lat - 0.5) + 0.5))
    const en = _grid.get(`${+lo.toFixed(1)},${+la.toFixed(1)}`)
    if (en) _onCursor(en.v, VARIABLES[_variable].unit, e.lngLat.lng, e.lngLat.lat, true)
    else    _onCursor(null, null, e.lngLat.lng, e.lngLat.lat, false)
  })
  // Leaving the map canvas hides the tooltip (covers timeline, legend, panels, etc.)
  map.getCanvas().addEventListener('mouseleave', () => _onCursor?.(null, null, 0, 0, false))
}

export async function loadAndRender() {
  if (!_ready) return
  const seq = ++_renderSeq
  if (_initialLoad) _onLoading?.(true)
  const meta = VARIABLES[_variable]
  const useDots = (_variable === 'ph' && !_compare)
  try {
    // Toggle between canvas ocean layer and pH dot layer
    map.setLayoutProperty(L_OCEAN,   'visibility', useDots ? 'none'    : 'visible')
    map.setLayoutProperty(L_PH_DOTS, 'visibility', useDots ? 'visible' : 'none')

    if (useDots) {
      // ── pH: raw points only, no gap-fill ──────────────────────
      const d = await loadData('ph', _year, _season)
      if (seq !== _renderSeq) return
      if (d) {
        _grid = _buildGridRaw(d.points, meta.domain[0], meta.domain[1])
        map.getSource(SRC_PH_DOTS)?.setData({
          type: 'FeatureCollection',
          features: d.points.map(p => ({
            type: 'Feature',
            geometry:   { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: { v: p.v },
          })),
        })
      }
    } else {
      // ── Canvas rendering (temperature / salinity / pH compare) ─
      let grid, colorStops, dMin, dMax
      if (_compare) {
        const [dB,dA]=await Promise.all([loadData(_variable,_yearB,_season),loadData(_variable,_yearA,_season)])
        if (seq !== _renderSeq) return
        if (dB&&dA){
          const mapA=new Map(dA.points.map(p=>[`${p.lon},${p.lat}`,p.v]))
          const pts=[]
          for(const p of dB.points){const r=mapA.get(`${p.lon},${p.lat}`);if(r!==undefined)pts.push({lon:p.lon,lat:p.lat,v:p.v-r})}
          ;[dMin,dMax]=meta.compareRange;colorStops=meta.diffStops;grid=_buildGrid(pts,dMin,dMax)
        }
      } else {
        const d=await loadData(_variable,_year,_season)
        if (seq !== _renderSeq) return
        if(d){;[dMin,dMax]=meta.domain;colorStops=meta.colorStops;grid=_buildGrid(d.points,dMin,dMax)}
      }
      if (grid) {
        _grid = grid
        const px = _renderToPixels(grid, colorStops, dMin, dMax)
        if (!_compare) _pixelCache.set(`${_variable}:${_season}:${_year}`, px)
        _applyPixels(px)
      }
    }
  } catch(e){ console.error('[map]',e) }
  finally {
    if (_initialLoad && seq === _renderSeq) {
      _onLoading?.(false)
      _initialLoad = false
    }
  }
}

let _rafPending  = false
let _pendingFrac = null

export function setYearFraction(frac) {
  if (!_ready || _compare || _variable === 'ph') return
  _pendingFrac = frac
  if (_rafPending) return          // déjà un frame en attente → on écrase juste la valeur
  _rafPending = true
  requestAnimationFrame(() => {
    _rafPending = false
    const f      = _pendingFrac
    const yearLo = Math.max(YEAR_MIN, Math.floor(f))
    const yearHi = Math.min(YEAR_MAX, yearLo + 1)
    const t      = f - yearLo
    const pxLo   = _pixelCache.get(`${_variable}:${_season}:${yearLo}`)
    const pxHi   = _pixelCache.get(`${_variable}:${_season}:${yearHi}`)
    if (!pxLo && !pxHi) return
    if (!pxLo || !pxHi || t < 0.01) { _applyPixels(pxLo || pxHi); return }
    _applyPixels(_blendPixels(pxLo, pxHi, t))
  })
}

export const setVariable     = v=>{_variable=v;loadAndRender()}
export const setYear         = y=>{_year=y;if(!_compare)loadAndRender()}
export const setSeason       = s=>{_season=s;loadAndRender()}
export const setCompareMode  = c=>{_compare=c;loadAndRender()}
export const setCompareYears = (a,b)=>{_yearA=a;_yearB=b;if(_compare)loadAndRender()}
export const zoomIn    = ()=>map?.zoomIn()
export const zoomOut   = ()=>map?.zoomOut()
export const zoomReset = ()=>map?.flyTo({center:MAP_CONFIG.center,zoom:MAP_CONFIG.zoom})
export const setProjection = proj => {
  if (!map) return
  map.setProjection(proj)
  map.setFog(proj === 'globe' ? _FOG_GLOBE : null)
}
export const onCursor  = fn=>{_onCursor=fn}
export const onLoading = fn=>{_onLoading=fn}
