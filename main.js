// ─────────────────────────────────────────────────────────────
// main.js  —  Ocean Health Dashboard — App Entry Point
// Wires together: map, timeline, panel, legend, cursor
// ─────────────────────────────────────────────────────────────

import './style.css'

import {
  initMap,
  setVariable, setYear, setSeason,
  setCompareMode, setCompareYears,
  zoomIn, zoomOut, zoomReset,
  onCursor, onLoading,
} from './map.js'

import { initTimeline, setCompareMode as tlSetCompare, getCompareYears } from './timeline.js'
import { initPanel, updatePanel }                                         from './panel.js'
import { initLegend, updateLegend }                                       from './legend.js'
import { initCursor, updateCursor, setCursorState }                       from './cursor.js'

import { DEFAULT_YEAR } from './config.js'

// ─────────────────────────────────────────
// APP STATE
// ─────────────────────────────────────────
const app = {
  variable:    'temperature',
  season:      'year',
  year:        DEFAULT_YEAR,
  compareMode: false,
  compareYearA: 1990,
  compareYearB: DEFAULT_YEAR,
}

// ─────────────────────────────────────────
// INIT ALL MODULES
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Map
  initMap('map')

  // Map callbacks
  onCursor((value, unit, lon, lat, hasData) => {
    updateCursor(value, unit, lon, lat, hasData)
  })
  onLoading((loading) => {
    const overlay = document.getElementById('map-loading')
    if (!overlay) return
    if (loading) {
      overlay.classList.remove('opacity-0', 'pointer-events-none')
      document.getElementById('loading-text').textContent = 'Loading data…'
    } else {
      overlay.classList.add('opacity-0', 'pointer-events-none')
    }
  })

  // Timeline
  initTimeline({
    onYearChange: (year) => {
      app.year = year
      setYear(year)
      _syncLegend()
    },
    onCompareChange: (yearA, yearB) => {
      app.compareYearA = yearA
      app.compareYearB = yearB
      setCompareYears(yearA, yearB)
      setCursorState(app.variable, app.compareMode, yearA, yearB)
      _syncLegend()
    },
  })

  // Panel
  initPanel()

  // Legend
  initLegend()

  // Cursor
  initCursor()

  // Wire UI controls
  _bindDataTabs()
  _bindCompareToggle()
  _bindSeasonSelect()
  _bindZoomButtons()

  // Initial sync
  _syncAll()
})

// ─────────────────────────────────────────
// UI BINDINGS
// ─────────────────────────────────────────
function _bindDataTabs() {
  document.querySelectorAll('.data-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.data-tab').forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      app.variable = tab.dataset.key
      setVariable(app.variable)
      setCursorState(app.variable, app.compareMode, app.compareYearA, app.compareYearB)
      updatePanel(app.variable, app.compareMode)
      _syncLegend()
    })
  })
}

function _bindCompareToggle() {
  const btn  = document.getElementById('compare-toggle')
  const pill = document.getElementById('compare-pill')

  btn.addEventListener('click', () => {
    app.compareMode = !app.compareMode
    btn.setAttribute('aria-checked', String(app.compareMode))

    // Toggle CSS state
    if (app.compareMode) {
      btn.classList.add('!bg-ocean-accent', '!border-ocean-accent')
      btn.querySelector('.toggle-thumb').style.transform = 'translateX(20px)'
      pill.classList.remove('hidden')
      pill.classList.add('flex')
    } else {
      btn.classList.remove('!bg-ocean-accent', '!border-ocean-accent')
      btn.querySelector('.toggle-thumb').style.transform = ''
      pill.classList.add('hidden')
      pill.classList.remove('flex')
    }

    tlSetCompare(app.compareMode)
    setCompareMode(app.compareMode)
    setCursorState(app.variable, app.compareMode, app.compareYearA, app.compareYearB)
    updatePanel(app.variable, app.compareMode)
    _syncLegend()
  })
}

function _bindSeasonSelect() {
  document.getElementById('season-select').addEventListener('change', e => {
    app.season = e.target.value
    setSeason(app.season)
    _syncLegend()
  })
}

function _bindZoomButtons() {
  document.getElementById('zoom-in')?.addEventListener('click',    zoomIn)
  document.getElementById('zoom-out')?.addEventListener('click',   zoomOut)
  document.getElementById('zoom-reset')?.addEventListener('click', zoomReset)
}

// ─────────────────────────────────────────
// SYNC HELPERS
// ─────────────────────────────────────────
function _syncLegend() {
  const { yearA, yearB } = getCompareYears()
  updateLegend(
    app.variable,
    app.compareMode,
    app.year,
    app.season,
    yearA,
    yearB,
  )
}

function _syncAll() {
  updatePanel(app.variable, app.compareMode)
  _syncLegend()
  setCursorState(app.variable, app.compareMode, app.compareYearA, app.compareYearB)
}
