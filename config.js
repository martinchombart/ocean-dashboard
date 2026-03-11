// ─────────────────────────────────────────────────────────────
// config.js  —  Central configuration for the Ocean Dashboard
// ─────────────────────────────────────────────────────────────

export const MAPBOX_TOKEN = 'pk.eyJ1IjoibWFydGluY2hvbWJhcnQiLCJhIjoiY21tbWlhMWdwMmJtcjJ3b3B3cDU4d2d3MyJ9.bvQUw5scp5wfeaC3O5Xrpw'

export const YEAR_MIN = 1960
export const YEAR_MAX = 2024
export const DEFAULT_YEAR = 2024

export const SEASONS = ['year', 'spring', 'summer', 'fall', 'winter']

// ── DATA VARIABLES ────────────────────────────────────────────
// Each variable defines:
//   label        — display name
//   unit         — unit string
//   filePrefix   — prefix used in JSON filenames
//   colorStops   — D3-compatible [value, cssColor] stops (anchored to 2024)
//   domain       — [min, max] for the 2024 color scale
//   compareRange — [min, max] for difference mode (symmetric around 0)
//   gradient     — CSS gradient for legend bar
//   accent       — UI accent color
//   importance   — info panel text
//   interpret    — how-to-read text
//   sources      — data source names
//   stats        — key stats [{label, value}]

export const VARIABLES = {
  temperature: {
    label:     'Sea Surface Temperature',
    unit:      '°C',
    filePrefix: 'sst',
    domain:    [-2, 32],
    compareRange: [-3, 3],
    colorStops: [
      [-2,   '#001e6e'],
      [ 4,   '#0050be'],
      [10,   '#00aad2'],
      [16,   '#50d2b4'],
      [22,   '#ffd732'],
      [28,   '#ff8200'],
      [32,   '#d21414'],
    ],
    // Difference color stops (anchored at 0 = no change)
    diffStops: [
      [-3,   '#143cc8'],
      [-1.5, '#3c8cdc'],
      [-0.5, '#a0d2e6'],
      [ 0,   '#f0f0f0'],
      [ 0.5, '#f0c878'],
      [ 1.5, '#e66e14'],
      [ 3,   '#c81414'],
    ],
    gradient:  'linear-gradient(90deg,#001e6e,#0050be,#00aad2,#50d2b4,#ffd732,#ff8200,#d21414)',
    diffGrad:  'linear-gradient(90deg,#143cc8,#3c8cdc,#a0d2e6,#f0f0f0,#f0c878,#e66e14,#c81414)',
    accent:    '#ff6b35',
    midLabel:  '15°C',
    importance: 'Sea Surface Temperature (SST) is the primary engine of global climate systems. It drives evaporation, storm intensity, ocean stratification, and marine ecosystem dynamics. Even a 1°C rise above seasonal averages can trigger coral bleaching events and disrupt fish migration routes across entire ocean basins.',
    interpret:  'Warm tones (orange/red) indicate waters above the long-term 2024 baseline. Blues mark colder regions — Arctic, Antarctic, and upwelling zones. In Compare mode, red means the ocean warmed between the two selected years; blue means it cooled.',
    sources:   ['NOAA ERSSTv5', 'Copernicus Marine (CMEMS)', 'HadSST4', 'Argo Float Network'],
    stats: [
      { label: 'Global SST anomaly (2024)', value: '+1.44°C' },
      { label: 'Rate of warming',           value: '+0.13°C / decade' },
      { label: 'Warmest year on record',    value: '2024' },
      { label: 'Coral bleaching threshold', value: '+1°C above mean' },
    ],
  },

  salinity: {
    label:     'Sea Surface Salinity',
    unit:      'PSU',
    filePrefix: 'sal',
    domain:    [30, 40],
    compareRange: [-1.5, 1.5],
    colorStops: [
      [30, '#003ca0'],
      [32, '#008cc8'],
      [34, '#14c8a0'],
      [36, '#00d264'],
      [38, '#00a050'],
      [40, '#008c32'],
    ],
    diffStops: [
      [-1.5, '#143cc8'],
      [-0.5, '#3c8cdc'],
      [-0.1, '#a0d2e6'],
      [ 0,   '#f0f0f0'],
      [ 0.1, '#f0c878'],
      [ 0.5, '#e66e14'],
      [ 1.5, '#c81414'],
    ],
    gradient:  'linear-gradient(90deg,#003ca0,#008cc8,#14c8a0,#00d264,#00a050,#008c32)',
    diffGrad:  'linear-gradient(90deg,#143cc8,#3c8cdc,#a0d2e6,#f0f0f0,#f0c878,#e66e14,#c81414)',
    accent:    '#00c9a7',
    midLabel:  '35 PSU',
    importance: 'Salinity controls ocean density, which drives thermohaline circulation — the global "conveyor belt" redistributing heat and nutrients. As polar ice melts, freshwater input is reducing salinity at high latitudes, threatening to weaken this circulation with potentially catastrophic climate consequences.',
    interpret:  'Deep blues indicate low-salinity regions (polar meltwater, heavy rainfall). Greens show saltier subtropical zones where evaporation exceeds precipitation. The increasing contrast between poles and subtropics directly signals acceleration of the water cycle.',
    sources:   ['World Ocean Atlas 2023 (NOAA)', 'NASA Aquarius/SAC-D', 'ESA SMOS', 'Argo BGC Floats'],
    stats: [
      { label: 'Global mean salinity',      value: '34.72 PSU' },
      { label: 'Arctic freshening (60 yr)', value: '-0.5 PSU' },
      { label: 'Subtropical trend',         value: '+0.02 PSU / yr' },
      { label: 'Water cycle amplification', value: '+4% per °C warming' },
    ],
  },

  ph: {
    label:     'Ocean pH',
    unit:      'pH',
    filePrefix: 'ph',
    domain:    [7.75, 8.25],
    compareRange: [-0.15, 0.15],
    colorStops: [
      [7.75, '#a01414'],
      [7.90, '#d25a0f'],
      [8.00, '#c8be28'],
      [8.10, '#50b450'],
      [8.18, '#3c78d2'],
      [8.25, '#5037b4'],
    ],
    diffStops: [
      [-0.15, '#5037b4'],   // more basic in the past = better
      [-0.05, '#3c78d2'],
      [-0.01, '#a0d2e6'],
      [ 0,    '#f0f0f0'],
      [ 0.01, '#f0c878'],
      [ 0.05, '#e66e14'],
      [ 0.15, '#c81414'],   // more acidic = worse
    ],
    gradient:  'linear-gradient(90deg,#a01414,#d25a0f,#c8be28,#50b450,#3c78d2,#5037b4)',
    diffGrad:  'linear-gradient(90deg,#5037b4,#3c78d2,#a0d2e6,#f0f0f0,#f0c878,#e66e14,#c81414)',
    accent:    '#a78bfa',
    midLabel:  '8.05',
    importance: 'Ocean acidification — driven by absorption of atmospheric CO₂ — dissolves the calcium carbonate structures of corals, mollusks, and plankton. Since 1750, ocean pH has dropped by 0.1 units, a 26% increase in acidity. This rate is faster than any natural change in 55 million years.',
    interpret:  'Red/orange tones indicate more acidic water (lower pH). Purple/blue marks relatively alkaline open-ocean water. Coastal upwelling zones and polar seas acidify fastest due to cold water absorbing more CO₂. In Compare mode, red = increasing acidity (deterioration).',
    sources:   ['SOCAT v2023', 'GOA-ON Network', 'MBARI', 'Argo BGC Floats'],
    stats: [
      { label: 'Pre-industrial pH',       value: '8.18' },
      { label: 'Current mean pH (2024)',  value: '8.08' },
      { label: 'Total acidification',     value: '26% since 1850' },
      { label: 'Projected 2100 (RCP8.5)', value: '7.95' },
    ],
  },
}

// ── MAP DEFAULTS ──────────────────────────────────────────────
export const MAP_CONFIG = {
  style:   'mapbox://styles/mapbox/dark-v11',
  center:  [0, 20],
  zoom:    1.8,
  minZoom: 1,
  maxZoom: 8,
  projection: 'naturalEarth',  // or 'globe', 'mercator'
}

// ── LAYER PAINT DEFAULTS ──────────────────────────────────────
export const HEATMAP_CONFIG = {
  // How the heatmap radius scales with zoom
  radiusBase:  2,
  radiusStops: [[0, 6], [3, 14], [6, 28]],
  // Opacity
  opacity:     0.82,
  // Weight property mapped to normalized data value
  weightProp:  'value_norm',
}
