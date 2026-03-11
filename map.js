// ─────────────────────────────────────────────────────────────
// map.js  —  Mapbox GL JS map + data layer rendering
// ─────────────────────────────────────────────────────────────

import mapboxgl from 'mapbox-gl'
import * as d3 from 'd3'
import { MAPBOX_TOKEN, MAP_CONFIG, VARIABLES, HEATMAP_CONFIG } from './config.js'
import { loadData, toGeoJSON, toDiffGeoJSON } from './dataLoader.js'

const SOURCE_ID = 'ocean-data'
const LAYER_HEATMAP = 'ocean-heatmap'
const LAYER_CIRCLE  = 'ocean-circles'   // shown at high zoom

let map = null
let currentVariable = 'temperature'
let currentSeason   = 'year'
let currentYear     = 2024
let compareMode     = false
let compareYearA    = 1990
let compareYearB    = 2024

// D3 color scale (rebuilt on variable change)
let colorScale = null

// Callbacks
let onCursorUpdate = null  // (value, unit, lon, lat, hasData) => void
let onLoadingChange = null // (bool) => void

// ─────────────────────────────────────────
// INIT
// ─────────────────────────────────────────
export function initMap(containerId) {
  mapboxgl.accessToken = MAPBOX_TOKEN

  map = new mapboxgl.Map({
    container: containerId,
    style:     MAP_CONFIG.style,
    center:    MAP_CONFIG.center,
    zoom:      MAP_CONFIG.zoom,
    minZoom:   MAP_CONFIG.minZoom,
    maxZoom:   MAP_CONFIG.maxZoom,
    projection: MAP_CONFIG.projection,
    // Remove default controls — we use our own
    attributionControl: true,
  })

  // Remove default nav controls
  // We manage zoom buttons in the UI

  map.on('load', () => {
    _setupSource()
    _setupLayers()
    _setupCursorEvents()
    loadAndRender()
  })

  return map
}

// ─────────────────────────────────────────
// SOURCE & LAYERS
// ─────────────────────────────────────────
function _setupSource() {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  })
}

function _setupLayers() {
  // Heatmap layer (low-mid zoom)
  map.addLayer({
    id:   LAYER_HEATMAP,
    type: 'heatmap',
    source: SOURCE_ID,
    maxzoom: 7,
    paint: {
      // Weight: use normalized value
      'heatmap-weight': [
        'interpolate', ['linear'],
        ['get', 'value_norm'],
        0, 0,
        1, 1,
      ],
      // Intensity scales with zoom
      'heatmap-intensity': [
        'interpolate', ['linear'], ['zoom'],
        0, 0.6,
        4, 1.2,
        7, 2.0,
      ],
      // Color — will be updated by _updateLayerColors()
      'heatmap-color': _buildHeatmapColorExpr(currentVariable, false),
      // Radius
      'heatmap-radius': [
        'interpolate', ['linear'], ['zoom'],
        0, 12,
        2, 18,
        4, 30,
        6, 55,
        8, 90,
      ],
      'heatmap-opacity': HEATMAP_CONFIG.opacity,
    },
  })

  // Circle layer (high zoom detail)
  map.addLayer({
    id:   LAYER_CIRCLE,
    type: 'circle',
    source: SOURCE_ID,
    minzoom: 5,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, 4,
        8, 10,
      ],
      'circle-color':   _buildCircleColorExpr(currentVariable, false),
      'circle-opacity': 0.7,
      'circle-blur':    0.5,
    },
  })
}

// ─────────────────────────────────────────
// COLOR EXPRESSIONS (Mapbox GL expressions using D3 scale)
// ─────────────────────────────────────────
function _buildHeatmapColorExpr(variable, isDiff) {
  const stops = isDiff
    ? VARIABLES[variable].diffStops
    : VARIABLES[variable].colorStops
  const meta = VARIABLES[variable]

  // Build a normalized-to-color scale
  const domain = isDiff ? meta.compareRange : meta.domain
  const dMin = domain[0], dMax = domain[1], range = dMax - dMin

  // Map each stop value -> normalized 0-1
  const colorExpr = ['interpolate', ['linear'], ['heatmap-density']]
  stops.forEach(([val, color]) => {
    const norm = Math.max(0, Math.min(1, (val - dMin) / range))
    colorExpr.push(norm, color)
  })

  return colorExpr
}

function _buildCircleColorExpr(variable, isDiff) {
  const stops = isDiff
    ? VARIABLES[variable].diffStops
    : VARIABLES[variable].colorStops
  const meta = VARIABLES[variable]
  const domain = isDiff ? meta.compareRange : meta.domain
  const dMin = domain[0], dMax = domain[1], range = dMax - dMin

  const colorExpr = ['interpolate', ['linear'], ['get', 'value_norm']]
  stops.forEach(([val, color]) => {
    const norm = Math.max(0, Math.min(1, (val - dMin) / range))
    colorExpr.push(norm, color)
  })

  return colorExpr
}

function _updateLayerColors() {
  if (!map || !map.getLayer(LAYER_HEATMAP)) return
  const isDiff = compareMode

  map.setPaintProperty(
    LAYER_HEATMAP, 'heatmap-color',
    _buildHeatmapColorExpr(currentVariable, isDiff)
  )
  map.setPaintProperty(
    LAYER_CIRCLE, 'circle-color',
    _buildCircleColorExpr(currentVariable, isDiff)
  )
}

// ─────────────────────────────────────────
// CURSOR EVENTS
// ─────────────────────────────────────────
function _setupCursorEvents() {
  map.on('mousemove', (e) => {
    if (!onCursorUpdate) return
    const { lng, lat } = e.lngLat

    // Query rendered features at this pixel
    const features = map.queryRenderedFeatures(e.point, {
      layers: [LAYER_CIRCLE, LAYER_HEATMAP],
    })

    if (features.length > 0) {
      const val = features[0].properties.value
      const meta = VARIABLES[currentVariable]
      onCursorUpdate(val, meta.unit, lng, lat, true)
    } else {
      onCursorUpdate(null, null, lng, lat, false)
    }
  })

  map.on('mouseleave', LAYER_CIRCLE,  () => onCursorUpdate?.(null, null, 0, 0, false))
  map.on('mouseleave', LAYER_HEATMAP, () => onCursorUpdate?.(null, null, 0, 0, false))
}

// ─────────────────────────────────────────
// DATA LOADING & RENDERING
// ─────────────────────────────────────────
export async function loadAndRender() {
  if (!map) return
  onLoadingChange?.(true)

  const meta = VARIABLES[currentVariable]

  let geojson

  if (compareMode) {
    const [dataB, dataA] = await Promise.all([
      loadData(currentVariable, compareYearB, currentSeason),
      loadData(currentVariable, compareYearA, currentSeason),
    ])

    if (!dataB || !dataA) {
      _showNoData()
      onLoadingChange?.(false)
      return
    }

    geojson = toDiffGeoJSON(dataB, dataA, meta.compareRange)
  } else {
    const data = await loadData(currentVariable, currentYear, currentSeason)
    if (!data) {
      _showNoData()
      onLoadingChange?.(false)
      return
    }
    geojson = toGeoJSON(data, meta.domain)
  }

  _updateLayerColors()

  const source = map.getSource(SOURCE_ID)
  if (source && geojson) {
    source.setData(geojson)
  }

  onLoadingChange?.(false)
}

function _showNoData() {
  const source = map.getSource(SOURCE_ID)
  if (source) {
    source.setData({ type: 'FeatureCollection', features: [] })
  }
}

// ─────────────────────────────────────────
// STATE SETTERS (called by UI)
// ─────────────────────────────────────────
export function setVariable(key) {
  currentVariable = key
  loadAndRender()
}

export function setYear(year) {
  currentYear = year
  if (!compareMode) loadAndRender()
}

export function setSeason(season) {
  currentSeason = season
  loadAndRender()
}

export function setCompareMode(enabled) {
  compareMode = enabled
  loadAndRender()
}

export function setCompareYears(yearA, yearB) {
  compareYearA = yearA
  compareYearB = yearB
  if (compareMode) loadAndRender()
}

// ─────────────────────────────────────────
// ZOOM CONTROLS
// ─────────────────────────────────────────
export function zoomIn()    { map?.zoomIn()  }
export function zoomOut()   { map?.zoomOut() }
export function zoomReset() { map?.flyTo({ center: MAP_CONFIG.center, zoom: MAP_CONFIG.zoom }) }

// ─────────────────────────────────────────
// CALLBACKS
// ─────────────────────────────────────────
export function onCursor(fn)  { onCursorUpdate  = fn }
export function onLoading(fn) { onLoadingChange = fn }
