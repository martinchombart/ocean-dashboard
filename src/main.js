// ─────────────────────────────────────────────────────────────
// main.js  —  Ocean Health Dashboard · Entry Point
// ─────────────────────────────────────────────────────────────

import './style.css'
import { DEFAULT_YEAR } from './config.js'
import {
  initMap, setVariable, setYear, setSeason,
  setCompareMode, setCompareYears,
  setYearFraction,
  zoomIn, zoomOut, zoomReset,
  setProjection,
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

  onCursor((value, unit, lon, lat, hasData) =>
    updateTooltip(value, unit, lon, lat, hasData)
  )
  onLoading(loading => setLoading(loading))

  initTimeline({
    onYearFrac: frac => setYearFraction(frac),
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
  _bindProjectionToggle()

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
  const trigger = document.getElementById('season-trigger')
  const options = document.getElementById('season-options')
  const label   = document.getElementById('season-label')
  const arrow   = document.getElementById('season-arrow')
  const labels  = { year: 'Full Year', spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' }

  let open = false

  const allOpts = document.querySelectorAll('.season-opt')

  const updateVisible = () => {
    allOpts.forEach(opt => {
      opt.style.display = opt.dataset.value === app.season ? 'none' : ''
    })
  }

  const close = () => {
    open = false
    options.style.maxHeight = '0'
    arrow.style.transform = ''
  }

  trigger.addEventListener('click', e => {
    e.stopPropagation()
    open = !open
    if (open) updateVisible()
    options.style.maxHeight = open ? '200px' : '0'
    arrow.style.transform = open ? 'rotate(180deg)' : ''
  })

  allOpts.forEach(opt => {
    opt.addEventListener('mouseenter', () => { opt.style.background = '#e0f2fe' })
    opt.addEventListener('mouseleave', () => { opt.style.background = '' })
    opt.addEventListener('click', e => {
      e.stopPropagation()
      app.season = opt.dataset.value
      label.textContent = labels[app.season]
      setSeason(app.season)
      _sync()
      close()
    })
  })

  updateVisible()
  document.addEventListener('click', close)
}

function _bindZoomButtons() {
  document.getElementById('btn-zoom-in')?.addEventListener('click',    zoomIn)
  document.getElementById('btn-zoom-out')?.addEventListener('click',   zoomOut)
  document.getElementById('btn-zoom-reset')?.addEventListener('click', zoomReset)
}

function _bindProjectionToggle() {
  const btn   = document.getElementById('projection-toggle')
  const thumb = document.getElementById('proj-thumb')
  let isGlobe = true

  btn.addEventListener('click', () => {
    isGlobe = !isGlobe
    btn.setAttribute('aria-checked', String(isGlobe))

    if (isGlobe) {
      btn.style.background   = '#0ea5e9'
      btn.style.borderColor  = '#0ea5e9'
      thumb.style.transform  = 'translateX(20px)'
    } else {
      btn.style.background   = '#bae6fd'
      btn.style.borderColor  = '#7dd3fc'
      thumb.style.transform  = ''
    }

    setProjection(isGlobe ? 'globe' : 'mercator')
  })
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
