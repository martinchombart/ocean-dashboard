// ================================================================
//  config.js  —  EDIT THIS FILE BEFORE RUNNING
//  1. Replace MAPBOX_TOKEN with your actual token
//  2. Everything else is pre-configured
// ================================================================

// ▼▼▼ PASTE YOUR MAPBOX TOKEN HERE ▼▼▼
export const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFydGluY2hvbWJhcnQiLCJhIjoiY21tbWlhMWdwMmJtcjJ3b3B3cDU4d2d3MyJ9.bvQUw5scp5wfeaC3O5Xrpw'
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

export const YEAR_MIN     = 1960
export const YEAR_MAX     = 2025
export const DEFAULT_YEAR = 2025

export const MAP_CONFIG = {
  style:      'mapbox://styles/mapbox/dark-v11',
  center:     [0, 15],
  zoom:       1.7,
  minZoom:    1,
  maxZoom:    9,
  projection: 'globe',
}

// ── VARIABLE DEFINITIONS ──────────────────────────────────────
// Each entry drives the color scale, legend, panel, cursor and
// data file naming conventions simultaneously.

export const VARIABLES = {

  temperature: {
    label:      'Sea Surface Temperature',
    unit:       '°C',
    filePrefix: 'sst',
    domain:     [-2, 32],
    midLabel:   '15°C',
    // Color stops: [data_value, css_color]  (anchored to 2024 range)
    colorStops: [
      [-2,  '#001e6e'],
      [ 4,  '#0050be'],
      [10,  '#00aad2'],
      [16,  '#50d2b4'],
      [22,  '#ffd732'],
      [28,  '#ff8200'],
      [32,  '#d21414'],
    ],
    // Difference color stops (symmetric, 0 = no change)
    compareRange: [-3, 3],
    diffStops: [
      [-3,  '#143cc8'],
      [-1,  '#3c8cdc'],
      [-0.3,'#a0d2e6'],
      [ 0,  '#f5f5f5'],
      [ 0.3,'#f0c878'],
      [ 1,  '#e66e14'],
      [ 3,  '#c81414'],
    ],
    gradient: 'linear-gradient(90deg,#001e6e,#0050be,#00aad2,#50d2b4,#ffd732,#ff8200,#d21414)',
    diffGrad: 'linear-gradient(90deg,#143cc8,#3c8cdc,#a0d2e6,#f5f5f5,#f0c878,#e66e14,#c81414)',
    accent: '#ff6b35',
    importance: 'Sea Surface Temperature (SST) is the primary engine of global climate systems. It drives evaporation, storm intensity, ocean stratification, and marine ecosystem dynamics. A single degree of warming above seasonal averages can trigger mass coral bleaching events and permanently disrupt fish migration routes.',
    interpret:  'Warm tones (orange → red) indicate waters above the long-term 2024 baseline. Deep blues mark colder zones — Arctic, Antarctic and coastal upwellings. In Compare mode, red = the ocean warmed between the selected years; blue = it cooled.',
    sources:    ['NOAA ERSSTv5', 'Copernicus Marine (CMEMS)', 'HadSST4', 'Argo Float Network'],
    stats: [
      { label: 'Global SST anomaly (2024)', value: '+1.44°C' },
      { label: 'Rate of warming',           value: '+0.13°C / decade' },
      { label: 'Warmest year on record',    value: '2024' },
      { label: 'Coral bleaching threshold', value: '+1°C above seasonal mean' },
    ],
  },

  salinity: {
    label:      'Sea Surface Salinity',
    unit:       'PSU',
    filePrefix: 'sal',
    domain:     [30, 40],
    midLabel:   '35 PSU',
    colorStops: [
      [30, '#003ca0'],
      [32, '#0078c8'],
      [34, '#14c8a0'],
      [36, '#00d264'],
      [38, '#009650'],
      [40, '#006432'],
    ],
    compareRange: [-1.5, 1.5],
    diffStops: [
      [-1.5, '#143cc8'],
      [-0.4, '#3c8cdc'],
      [-0.1, '#a0d2e6'],
      [ 0,   '#f5f5f5'],
      [ 0.1, '#f0c878'],
      [ 0.4, '#e66e14'],
      [ 1.5, '#c81414'],
    ],
    gradient: 'linear-gradient(90deg,#003ca0,#0078c8,#14c8a0,#00d264,#009650,#006432)',
    diffGrad: 'linear-gradient(90deg,#143cc8,#3c8cdc,#a0d2e6,#f5f5f5,#f0c878,#e66e14,#c81414)',
    accent: '#00c9a7',
    importance: 'Salinity drives thermohaline circulation — the ocean "conveyor belt" that redistributes heat and oxygen globally. As polar ice melts, freshwater input is reducing salinity at high latitudes, threatening to slow or collapse this circulation with potentially catastrophic climate consequences for Europe and North America.',
    interpret:  'Deep blues signal low-salinity regions (polar meltwater, heavy rainfall zones). Greens mark saltier subtropical areas where evaporation exceeds precipitation. The widening contrast between poles and subtropics directly reflects acceleration of the global water cycle.',
    sources:    ['World Ocean Atlas 2023 (NOAA)', 'NASA Aquarius/SAC-D', 'ESA SMOS', 'Argo BGC Floats'],
    stats: [
      { label: 'Global mean salinity',      value: '34.72 PSU' },
      { label: 'Arctic freshening (60 yr)', value: '-0.5 PSU' },
      { label: 'Subtropical increase rate', value: '+0.02 PSU / yr' },
      { label: 'Water cycle amplification', value: '+4% per °C of warming' },
    ],
  },

  ph: {
    label:      'Ocean pH',
    unit:       'pH',
    filePrefix: 'ph',
    domain:     [7.75, 8.25],
    midLabel:   '8.05',
    colorStops: [
      [7.75, '#a01414'],
      [7.90, '#d25a0f'],
      [7.98, '#c8be28'],
      [8.08, '#50b450'],
      [8.18, '#3c78d2'],
      [8.25, '#5037b4'],
    ],
    compareRange: [-0.15, 0.15],
    diffStops: [
      [-0.15, '#5037b4'],   // more alkaline in the past = improvement
      [-0.05, '#3c78d2'],
      [-0.01, '#a0d2e6'],
      [ 0,    '#f5f5f5'],
      [ 0.01, '#f0c878'],
      [ 0.05, '#e66e14'],
      [ 0.15, '#c81414'],   // more acidic = deterioration
    ],
    gradient: 'linear-gradient(90deg,#a01414,#d25a0f,#c8be28,#50b450,#3c78d2,#5037b4)',
    diffGrad: 'linear-gradient(90deg,#5037b4,#3c78d2,#a0d2e6,#f5f5f5,#f0c878,#e66e14,#c81414)',
    accent: '#a78bfa',
    importance: 'Ocean acidification — driven by absorption of atmospheric CO₂ — dissolves the calcium carbonate structures of corals, mollusks, and plankton that form the base of marine food webs. Since 1750, ocean pH has dropped by 0.1 units — a 26% increase in hydrogen ion concentration. This rate is faster than any natural change in 55 million years.',
    interpret:  'Red/orange tones indicate more acidic water (lower pH = worse). Purple/blue marks relatively alkaline open-ocean water. Coastal upwelling zones and polar seas acidify fastest. In Compare mode, red = increasing acidity (deterioration); blue = relative improvement.',
    sources:    ['SOCAT v2023', 'GOA-ON Network', 'MBARI', 'Argo BGC Floats'],
    stats: [
      { label: 'Pre-industrial pH',       value: '8.18' },
      { label: 'Current mean pH (2024)',  value: '8.08' },
      { label: 'Total acidification',     value: '26% since 1850' },
      { label: 'Projected 2100 (RCP8.5)', value: '~7.95' },
    ],
  },

}
