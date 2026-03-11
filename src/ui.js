// ─────────────────────────────────────────────────────────────
// ui.js  —  All DOM UI updates: legend, badge, tooltip, panel
// ─────────────────────────────────────────────────────────────

import { VARIABLES } from './config.js'

// ─────────────────────────────────────────
// LEGEND
// ─────────────────────────────────────────
export function updateLegend({ variable, compare, year, season, yearA, yearB }) {
  const meta = VARIABLES[variable]
  if (!meta) return

  const seasonLabel = document.getElementById('season-select')?.options[
    document.getElementById('season-select')?.selectedIndex
  ]?.text || season

  document.getElementById('leg-title').textContent = meta.label

  if (compare) {
    document.getElementById('leg-bar').style.background = meta.diffGrad
    document.getElementById('leg-min').textContent = meta.compareRange[0] + ' ' + meta.unit
    document.getElementById('leg-mid').textContent = '± 0'
    document.getElementById('leg-max').textContent = '+' + meta.compareRange[1] + ' ' + meta.unit
    document.getElementById('leg-mode').innerHTML =
      `<span style="color:#fbbf24">Δ</span> Difference ${yearA} → ${yearB}`
  } else {
    document.getElementById('leg-bar').style.background = meta.gradient
    document.getElementById('leg-min').textContent = meta.domain[0] + ' ' + meta.unit
    document.getElementById('leg-mid').textContent = meta.midLabel
    document.getElementById('leg-max').textContent = meta.domain[1] + ' ' + meta.unit
    document.getElementById('leg-mode').textContent = ''
  }

  // Badge
  const badge = document.getElementById('badge-text')
  if (badge) {
    badge.textContent = compare
      ? `Compare Mode · ${yearA} → ${yearB} · ${seasonLabel}`
      : `Normal Mode · ${year} · ${seasonLabel}`
  }
}

// ─────────────────────────────────────────
// CURSOR TOOLTIP
// ─────────────────────────────────────────
let _tooltipVariable = 'temperature'
let _tooltipCompare  = false
let _tooltipYearA    = 1990
let _tooltipYearB    = 2024

export function initTooltip() {
  const wrap = document.getElementById('map-wrap')
  const tt   = document.getElementById('tooltip')
  wrap.addEventListener('mousemove', e => {
    tt.style.left = (e.clientX + 18) + 'px'
    tt.style.top  = (e.clientY - 48) + 'px'
  })
  wrap.addEventListener('mouseleave', () => tt.classList.add('hidden'))
}

export function updateTooltip(value, unit, lon, lat, hasData) {
  const tt   = document.getElementById('tooltip')
  const meta = VARIABLES[_tooltipVariable]

  document.getElementById('tt-label').textContent = meta?.label || ''

  const latStr = lat >= 0 ? lat.toFixed(2) + '°N' : Math.abs(lat).toFixed(2) + '°S'
  const lonStr = lon >= 0 ? lon.toFixed(2) + '°E' : Math.abs(lon).toFixed(2) + '°W'
  document.getElementById('tt-coord').textContent = `${latStr},  ${lonStr}`

  if (!hasData || value === null || value === undefined) {
    document.getElementById('tt-value').textContent = 'No data'
    document.getElementById('tt-unit').textContent  = 'Lack of data in this region'
  } else if (_tooltipCompare) {
    const sign = value >= 0 ? '+' : ''
    document.getElementById('tt-value').textContent = sign + value.toFixed(3)
    document.getElementById('tt-unit').textContent  =
      `${unit} change  (${_tooltipYearA} → ${_tooltipYearB})`
  } else {
    document.getElementById('tt-value').textContent = value.toFixed(2)
    document.getElementById('tt-unit').textContent  = unit || ''
  }

  tt.classList.remove('hidden')
}

export function setTooltipState(variable, compare, yearA, yearB) {
  _tooltipVariable = variable
  _tooltipCompare  = compare
  _tooltipYearA    = yearA
  _tooltipYearB    = yearB
}

// ─────────────────────────────────────────
// LOADING OVERLAY
// ─────────────────────────────────────────
export function setLoading(on) {
  const el = document.getElementById('loading')
  if (!el) return
  if (on) {
    el.style.opacity = '1'
    el.style.pointerEvents = 'auto'
  } else {
    el.style.opacity = '0'
    el.style.pointerEvents = 'none'
  }
}

// ─────────────────────────────────────────
// INFO PANEL
// ─────────────────────────────────────────
export function initPanel() {
  const toggle = document.getElementById('panel-toggle')
  const panel  = document.getElementById('info-panel')
  let collapsed = false

  toggle.addEventListener('click', () => {
    collapsed = !collapsed
    panel.style.width    = collapsed ? '0px' : ''
    panel.style.overflow = collapsed ? 'hidden' : ''
    panel.style.borderLeft = collapsed ? 'none' : ''
    toggle.textContent   = collapsed ? '›' : '‹'
  })
}

export function renderPanel(variable) {
  const content = document.getElementById('panel-content')
  const meta    = VARIABLES[variable]
  if (!content || !meta) return

  const statsHtml = meta.stats.map(s => `
    <div class="stat-row">
      <span class="text-gray-400">${s.label}</span>
      <span class="stat-val" style="color:${meta.accent}">${s.value}</span>
    </div>`).join('')

  const srcHtml = meta.sources.map(s => `<span class="src-tag">${s}</span>`).join('')

  content.innerHTML = `
    <div>
      <h2 class="font-display font-black text-[18px] text-white leading-tight mb-1">${meta.label}</h2>
      <div class="h-0.5 w-8 rounded-full mb-3" style="background:${meta.accent}"></div>
      <p class="text-[10px] leading-relaxed text-gray-400">${meta.importance}</p>
    </div>

    <div class="info-card">
      <div class="ic-title" style="color:${meta.accent}">📊 Key Statistics</div>
      ${statsHtml}
    </div>

    <div class="info-card">
      <div class="ic-title" style="color:${meta.accent}">🗺 How to Read the Map</div>
      <p class="text-[10px] leading-relaxed text-gray-400">${meta.interpret}</p>
    </div>

    <div class="info-card">
      <div class="ic-title" style="color:${meta.accent}">⏱ Compare Mode</div>
      <p class="text-[10px] leading-relaxed text-gray-400">
        Toggle <strong class="text-gray-200">Compare</strong> in the top bar.
        Drag the <span style="color:#ff6b35">orange handle</span> (earlier year)
        and <span style="color:#00b4ff">blue handle</span> (later year) on the timeline.
        The map switches to a signed difference view — warm reds signal deterioration,
        cool blues signal improvement.
      </p>
    </div>

    <div class="info-card">
      <div class="ic-title" style="color:${meta.accent}">📡 Data Sources</div>
      <p class="text-[10px] text-gray-400 mb-2">Gridded means derived from:</p>
      ${srcHtml}
      <p class="text-[9px] text-gray-600 mt-2">
        Color scale anchored to 2024 baseline. Educational visualization.
      </p>
    </div>

    <div class="info-card" style="border-color:rgba(180,60,30,.35)">
      <div class="ic-title" style="color:#f87171">⚠ Why It Matters</div>
      <p class="text-[10px] leading-relaxed text-gray-400">
        The ocean absorbs <strong class="text-gray-200">90% of excess heat</strong>
        and <strong class="text-gray-200">25% of CO₂</strong> from human activity.
        Every degree of warming, every pH unit lost, every disrupted current
        has cascading effects on billions of lives and millions of species.
      </p>
    </div>

    <p class="text-center text-[9px] text-gray-600 pb-1 leading-relaxed">
      NOAA · Copernicus Marine · NASA · SOCAT<br>
      For educational & awareness purposes only
    </p>`
}
