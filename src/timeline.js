// ─────────────────────────────────────────────────────────────
// timeline.js  —  Year scrubber + compare handle drag
// ─────────────────────────────────────────────────────────────

import { YEAR_MIN, YEAR_MAX, DEFAULT_YEAR } from './config.js'

const MARKS = []
for (let y = YEAR_MIN; y <= YEAR_MAX; y += 10) MARKS.push(y)
if (MARKS[MARKS.length - 1] !== YEAR_MAX) MARKS.push(YEAR_MAX)

let _compare = false
let _year    = DEFAULT_YEAR
let _yearA   = 1990
let _yearB   = DEFAULT_YEAR
let _onYear, _onCompare

// DOM
let track, fill, hdlA, hdlB

export function initTimeline({ onYearChange, onCompareChange }) {
  _onYear    = onYearChange
  _onCompare = onCompareChange

  track = document.getElementById('tl-track')
  fill  = document.getElementById('tl-fill')
  hdlA  = document.getElementById('hdl-a')
  hdlB  = document.getElementById('hdl-b')

  _buildMarks()

  // Click track → set year (normal mode)
  track.addEventListener('click', e => {
    if (_compare) return
    if (e.target === hdlA || e.target === hdlB) return
    _setYear(_evtToYear(e))
  })

  _makeDraggable(hdlA, 'a')
  _makeDraggable(hdlB, 'b')

  _render()
}

function _buildMarks() {
  const container = document.getElementById('tl-marks')
  container.innerHTML = ''
  MARKS.forEach(y => {
    const el = document.createElement('div')
    el.className = 'tl-mark' + (y === _year ? ' active' : '')
    el.style.left = _y2p(y) + '%'
    el.innerHTML  = `<div class="tl-dot"></div><span class="tl-yr">${y}</span>`
    el.addEventListener('click', () => { if (!_compare) _setYear(y) })
    container.appendChild(el)
  })
}

function _makeDraggable(handle, which) {
  let drag = false
  handle.addEventListener('mousedown', e => { drag = true; e.stopPropagation(); e.preventDefault() })
  document.addEventListener('mousemove', e => {
    if (!drag) return
    const y = _evtToYear(e)
    if (which === 'a') _yearA = Math.min(y, _yearB - 1)
    else               _yearB = Math.max(y, _yearA + 1)
    _render()
    _onCompare?.(_yearA, _yearB)
  })
  document.addEventListener('mouseup', () => { drag = false })
  handle.addEventListener('touchstart', e => { drag = true; e.stopPropagation() }, { passive: true })
  document.addEventListener('touchmove', e => {
    if (!drag) return
    const y = _evtToYear(e.touches[0])
    if (which === 'a') _yearA = Math.min(y, _yearB - 1)
    else               _yearB = Math.max(y, _yearA + 1)
    _render()
    _onCompare?.(_yearA, _yearB)
  }, { passive: true })
  document.addEventListener('touchend', () => { drag = false })
}

function _render() {
  if (_compare) {
    hdlA.classList.remove('hidden')
    hdlB.classList.remove('hidden')
    document.getElementById('tl-cmp-hint').classList.remove('hidden')
    document.getElementById('yr-display').classList.add('hidden')
    document.getElementById('cmp-display').classList.remove('hidden')
    document.getElementById('cmp-display').classList.add('flex')

    const pA = _y2p(_yearA), pB = _y2p(_yearB)
    hdlA.style.left  = pA + '%'
    hdlB.style.left  = pB + '%'
    fill.style.left  = pA + '%'
    fill.style.width = (pB - pA) + '%'

    document.getElementById('cmp-a').textContent = _yearA
    document.getElementById('cmp-b').textContent = _yearB
  } else {
    hdlA.classList.add('hidden')
    hdlB.classList.add('hidden')
    document.getElementById('tl-cmp-hint').classList.add('hidden')
    document.getElementById('yr-display').classList.remove('hidden')
    document.getElementById('cmp-display').classList.add('hidden')
    document.getElementById('cmp-display').classList.remove('flex')

    fill.style.left  = '0%'
    fill.style.width = _y2p(_year) + '%'
    document.getElementById('yr-display').textContent = _year
  }

  // Sync mark active state
  document.querySelectorAll('.tl-mark').forEach(el => {
    const y = parseInt(el.querySelector('.tl-yr').textContent)
    el.classList.toggle('active', y === _year && !_compare)
  })
}

// ─────────────────────────────────────────
function _y2p(y)  { return ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * 100 }
function _p2y(p)  { return Math.round(Math.max(YEAR_MIN, Math.min(YEAR_MAX, YEAR_MIN + (p / 100) * (YEAR_MAX - YEAR_MIN)))) }
function _evtToYear(e) {
  const r = track.getBoundingClientRect()
  return _p2y(((e.clientX - r.left) / r.width) * 100)
}
function _setYear(y) { _year = y; _render(); _onYear?.(y) }

export function setCompareMode(v) { _compare = v; _render() }
export function setYear(y)        { _year = y;    _render() }
export function getCompareYears() { return { yearA: _yearA, yearB: _yearB } }
