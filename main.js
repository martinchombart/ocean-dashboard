// ─────────────────────────────────────────────────────────────
// main.js  —  Ocean Health Dashboard · Entry Point
// ─────────────────────────────────────────────────────────────

import './style.css'
import { DEFAULT_YEAR } from './config.js'
import {
  initMap, setVariable, setYear, setSeason,
  setCompareMode, setCompareYears,
  zoomIn, zoomOut, zoomReset,
  onCursor, onLoading,
} from './map.js'
import {
  initTimeline, setCompareMode as tlSetCompare, getCompareYears
} from './timeline.js'
import {
  initTooltip, updateTooltip, setTooltipState,
  updateLegend, setLoading, initPanel, renderPanel,
} from './ui.js'

// ─────────────────────────────────────────
// APP STATE
// ─────────────────────────────────────────
const app = {
  variable:  'temperature',
  season:    'year',
  year:      DEFAULT_YEAR,
  compare:   false,
  yearA:     1990,
  yearB:     DEFAULT_YEAR,
}

// ─────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap('map')

  // Fallback: hide loading overlay after 3s regardless
  setTimeout(() => setLoading(false), 3000)

  onCursor((value, unit, lon, lat, hasData) =>
    updateTooltip(value, unit, lon, lat, hasData)
  )
  onLoading(loading => setLoading(loading))

  initTimeline({
    onYearChange: year => {
      app.year = year
      setYear(year)
      _sync()
    },
    onCompareChange: (yearA, yearB) => {
      app.yearA = yearA
      app.yearB = yearB
      setCompareYears(yearA, yearB)
      setTooltipState(app.variable, app.compare, yearA, yearB)
      _sync()
    },
  })

  initTooltip()
  initPanel()

  _bindTabs()
  _bindCompareToggle()
  _bindSeasonSelect()
  _bindZoomButtons()

  _sync()
})

// ─────────────────────────────────────────
// UI BINDINGS
// ─────────────────────────────────────────
function _bindTabs() {
  document.querySelectorAll('.data-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.data-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      app.variable = tab.dataset.key
      setVariable(app.variable)
      setTooltipState(app.variable, app.compare, app.yearA, app.yearB)
      renderPanel(app.variable)
      _sync()
    })
  })
}

function _bindCompareToggle() {
  const btn   = document.getElementById('compare-toggle')
  const thumb = document.getElementById('toggle-thumb')
  const pill  = document.getElementById('compare-pill')

  btn.addEventListener('click', () => {
    app.compare = !app.compare
    btn.setAttribute('aria-checked', String(app.compare))

    if (app.compare) {
      btn.classList.add('!bg-ocean-accent', '!border-ocean-accent')
      thumb.style.transform = 'translateX(20px)'
      pill.classList.remove('hidden'); pill.classList.add('flex')
    } else {
      btn.classList.remove('!bg-ocean-accent', '!border-ocean-accent')
      thumb.style.transform = ''
      pill.classList.add('hidden'); pill.classList.remove('flex')
    }

    tlSetCompare(app.compare)
    setCompareMode(app.compare)
    setTooltipState(app.variable, app.compare, app.yearA, app.yearB)
    _sync()
  })
}

function _bindSeasonSelect() {
  document.getElementById('season-select').addEventListener('change', e => {
    app.season = e.target.value
    setSeason(app.season)
    _sync()
  })
}

function _bindZoomButtons() {
  document.getElementById('btn-zoom-in')?.addEventListener('click',    zoomIn)
  document.getElementById('btn-zoom-out')?.addEventListener('click',   zoomOut)
  document.getElementById('btn-zoom-reset')?.addEventListener('click', zoomReset)
}

// ─────────────────────────────────────────
// SYNC LEGEND + PANEL
// ─────────────────────────────────────────
function _sync() {
  const { yearA, yearB } = getCompareYears()
  updateLegend({
    variable: app.variable,
    compare:  app.compare,
    year:     app.year,
    season:   app.season,
    yearA, yearB,
  })
  renderPanel(app.variable)
}
