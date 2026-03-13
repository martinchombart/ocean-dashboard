// ─────────────────────────────────────────────────────────────
// map.js  —  Mapbox GL map + heatmap layer management
// ─────────────────────────────────────────────────────────────

import mapboxgl from 'mapbox-gl/dist/mapbox-gl.js'
import { MAPBOX_TOKEN, MAP_CONFIG, VARIABLES } from './config.js'
import { loadData, toGeoJSON, toDiffGeoJSON, emptyFC } from './dataLoader.js'

const SRC  = 'ocean-data'
const L_HM = 'layer-heatmap'
const L_PT = 'layer-points'

let map
let _variable    = 'temperature'
let _season      = 'year'
let _year        = 2024
let _compare     = false
let _yearA       = 1990
let _yearB       = 2024
let _onCursor    = null
let _onLoading   = null

// ─────────────────────────────────────────
export function initMap(containerId) {
  mapboxgl.accessToken = MAPBOX_TOKEN

  map = new mapboxgl.Map({
    container:  containerId,
    style:      MAP_CONFIG.style,
    center:     MAP_CONFIG.center,
    zoom:       MAP_CONFIG.zoom,
    minZoom:    MAP_CONFIG.minZoom,
    maxZoom:    MAP_CONFIG.maxZoom,
    projection: MAP_CONFIG.projection,
    attributionControl: true,
  })

  map.on('load', () => {
    console.log('[map] load fired')
    _addSource()
    _addLayers()
    _bindCursor()
    loadAndRender()
  })

  map.on('error', e => console.error('[map] error:', e.error))

  // Fallback: if style blocks load event, try after delay
  setTimeout(() => {
    if (!map.loaded()) {
      console.warn('[map] load event never fired, forcing init')
      try { _addSource() } catch(e) {}
      try { _addLayers() } catch(e) {}
      _bindCursor()
      loadAndRender()
    }
  }, 5000)

  return map
}

// ─────────────────────────────────────────
// SOURCE + LAYERS
// ─────────────────────────────────────────
function _addSource() {
  map.addSource(SRC, { type: 'geojson', data: emptyFC() })
}

function _addLayers() {
  // Heatmap — displayed at zoom 0–7
  map.addLayer({
    id: L_HM, type: 'heatmap', source: SRC, maxzoom: 7.5,
    paint: {
      'heatmap-weight':    ['interpolate', ['linear'], ['get', 'value_norm'], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.5, 4, 1.2, 7, 2.2],
      'heatmap-color':     _hmColorExpr(),
      'heatmap-radius':    ['interpolate', ['linear'], ['zoom'], 0,14, 2,20, 4,32, 6,58, 8,95],
      'heatmap-opacity':   0.85,
    },
  })

  // Circles — displayed at zoom 5+
  map.addLayer({
    id: L_PT, type: 'circle', source: SRC, minzoom: 5,
    paint: {
      'circle-radius':  ['interpolate', ['linear'], ['zoom'], 5,4, 8,12],
      'circle-color':   _ptColorExpr(),
      'circle-opacity': 0.72,
      'circle-blur':    0.4,
    },
  })
}

// ─────────────────────────────────────────
// COLOR EXPRESSIONS
// ─────────────────────────────────────────
function _colorStops() {
  const meta  = VARIABLES[_variable]
  const stops = _compare ? meta.diffStops   : meta.colorStops
  const dom   = _compare ? meta.compareRange : meta.domain
  const [dMin, dMax] = dom
  const range = dMax - dMin || 1
  // Normalize each stop value to 0–1
  return stops.map(([val, color]) => [
    Math.max(0, Math.min(1, (val - dMin) / range)),
    color,
  ])
}

function _hmColorExpr() {
  const stops = _colorStops()
  const expr  = ['interpolate', ['linear'], ['heatmap-density']]
  stops.forEach(([n, c]) => expr.push(n, c))
  return expr
}

function _ptColorExpr() {
  const stops = _colorStops()
  const expr  = ['interpolate', ['linear'], ['get', 'value_norm']]
  stops.forEach(([n, c]) => expr.push(n, c))
  return expr
}

function _refreshColors() {
  if (!map.getLayer(L_HM)) return
  map.setPaintProperty(L_HM, 'heatmap-color', _hmColorExpr())
  map.setPaintProperty(L_PT, 'circle-color',  _ptColorExpr())
}

// ─────────────────────────────────────────
// CURSOR
// ─────────────────────────────────────────
function _bindCursor() {
  map.on('mousemove', e => {
    if (!_onCursor) return
    const { lng, lat } = e.lngLat
    // Query nearest rendered feature
    const feats = map.queryRenderedFeatures(e.point, { layers: [L_PT, L_HM] })
    if (feats.length) {
      _onCursor(feats[0].properties.value, VARIABLES[_variable].unit, lng, lat, true)
    } else {
      _onCursor(null, null, lng, lat, false)
    }
  })
  map.getCanvas().addEventListener('mouseleave', () => _onCursor?.(null, null, 0, 0, false))
}

// ─────────────────────────────────────────
// DATA LOAD + RENDER
// ─────────────────────────────────────────
export async function loadAndRender() {
  if (!map?.loaded()) return
  _onLoading?.(true)

  const meta = VARIABLES[_variable]
  let geojson

  try {
    if (_compare) {
      const [dB, dA] = await Promise.all([
        loadData(_variable, _yearB, _season),
        loadData(_variable, _yearA, _season),
      ])
      geojson = dB && dA ? toDiffGeoJSON(dB, dA, meta.compareRange) : emptyFC()
    } else {
      const d = await loadData(_variable, _year, _season)
      geojson = d ? toGeoJSON(d, meta.domain) : emptyFC()
    }
  } catch (err) {
    console.error('[map] render error', err)
    geojson = emptyFC()
  }

  _refreshColors()
  map.getSource(SRC)?.setData(geojson)
  _onLoading?.(false)
}

// ─────────────────────────────────────────
// STATE SETTERS
// ─────────────────────────────────────────
export const setVariable    = v           => { _variable = v;           loadAndRender() }
export const setYear        = y           => { _year     = y; if (!_compare) loadAndRender() }
export const setSeason      = s           => { _season   = s;           loadAndRender() }
export const setCompareMode = c           => { _compare  = c;           loadAndRender() }
export const setCompareYears = (a, b)     => { _yearA = a; _yearB = b;  if (_compare) loadAndRender() }

export const zoomIn    = () => map?.zoomIn()
export const zoomOut   = () => map?.zoomOut()
export const zoomReset = () => map?.flyTo({ center: MAP_CONFIG.center, zoom: MAP_CONFIG.zoom })

export const onCursor  = fn => { _onCursor  = fn }
export const onLoading = fn => { _onLoading = fn }
