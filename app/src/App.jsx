import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const USERS = [
  { id: 1, name: 'Алексей', initials: 'АЛ', color: '#EDE0FF' },
  { id: 2, name: 'Мария',   initials: 'МА', color: '#DCF0FF' },
  { id: 3, name: 'Саша',    initials: 'СА', color: '#DCF5E8' },
  { id: 4, name: 'Никита',  initials: 'НИ', color: '#FFF0DC' },
]

function PlaneIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Quadratic bezier point
function qbez(t, a, b, c) {
  const m = 1 - t
  return m * m * a + 2 * m * t * b + t * t * c
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// Offset control point perpendicular to the line for a natural arc
function arcCtrl(x0, y0, x1, y1, curvature = 0.28) {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  return {
    cx: mx - (dy / len) * len * curvature,
    cy: my + (dx / len) * len * curvature,
  }
}

// Chip closest to the given point
function nearestChip(refs, px, py) {
  let bestId = null, bestDist = Infinity
  for (const [id, el] of Object.entries(refs)) {
    if (!el) continue
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const d = Math.hypot(cx - px, cy - py)
    if (d < bestDist) { bestDist = d; bestId = Number(id) }
  }
  return bestId
}

// Center of a chip element
function chipCenter(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export default function App() {
  const [message,  setMessage]  = useState('')
  const [phase,    setPhase]    = useState('idle') // idle | drag | fly | return
  const [planePos, setPlanePos] = useState(null)   // {x,y} viewport
  const [origin,   setOrigin]   = useState(null)   // button center at drag start
  const [aimId,    setAimId]    = useState(null)   // chip being aimed at
  const [sentTo,   setSentTo]   = useState(null)   // chip that received message
  const [btnIcon,  setBtnIcon]  = useState(true)

  const btnRef   = useRef(null)
  const chipRefs = useRef({})
  const rafRef   = useRef(null)
  const flyRef   = useRef(null)

  // ── Helpers ────────────────────────────────────────────────────

  const getBtnCenter = () => {
    const r = btnRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }

  // Angle for plane icon: nose points from (px,py) toward (tx,ty)
  // The SVG plane points upper-right by default, so add 45° offset
  const aimAngle = useCallback((px, py, tx, ty) => {
    return Math.atan2(ty - py, tx - px) * (180 / Math.PI) + 45
  }, [])

  // ── Pointer handlers ───────────────────────────────────────────

  const onPointerDown = useCallback((e) => {
    if (!message.trim()) return
    e.preventDefault()
    cancelAnimationFrame(rafRef.current)
    const center = getBtnCenter()
    if (!center) return
    setOrigin(center)
    setPlanePos(center)
    setPhase('drag')
    setBtnIcon(false)
    setAimId(nearestChip(chipRefs.current, center.x, center.y))
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [message])

  const onPointerMove = useCallback((e) => {
    if (phase !== 'drag') return
    const x = e.clientX, y = e.clientY
    setPlanePos({ x, y })
    const id = nearestChip(chipRefs.current, x, y)
    if (id !== null) setAimId(id)
  }, [phase])

  const onPointerUp = useCallback((e) => {
    if (phase !== 'drag') return

    const x = e.clientX, y = e.clientY
    const dragDist = origin ? Math.hypot(x - origin.x, y - origin.y) : 0

    // Not enough drag → return plane to button
    if (dragDist < 24 || !aimId) {
      launchReturn(x, y)
      return
    }

    // Launch toward aimed chip
    const chipEl = chipRefs.current[aimId]
    if (!chipEl) { launchReturn(x, y); return }

    const { x: tx, y: ty } = chipCenter(chipEl)
    const { cx, cy } = arcCtrl(x, y, tx, ty)

    flyRef.current = { x0: x, y0: y, cx, cy, tx, ty, tid: aimId, start: null, dur: 420 }
    setPhase('fly')
    setAimId(null)
    rafRef.current = requestAnimationFrame(tickFly)
  }, [phase, origin, aimId])

  // ── Animations ─────────────────────────────────────────────────

  function launchReturn(x, y) {
    if (!origin) {
      setPhase('idle'); setPlanePos(null); setAimId(null)
      setTimeout(() => setBtnIcon(true), 80)
      return
    }
    const { cx, cy } = arcCtrl(x, y, origin.x, origin.y, 0.2)
    flyRef.current = { x0: x, y0: y, cx, cy, tx: origin.x, ty: origin.y, tid: null, start: null, dur: 260 }
    setPhase('return')
    setAimId(null)
    rafRef.current = requestAnimationFrame(tickReturn)
  }

  function tickFly(now) {
    const f = flyRef.current
    if (!f.start) f.start = now
    const raw = Math.min((now - f.start) / f.dur, 1)
    const t   = easeInOut(raw)
    setPlanePos({ x: qbez(t, f.x0, f.cx, f.tx), y: qbez(t, f.y0, f.cy, f.ty) })
    if (raw < 1) {
      rafRef.current = requestAnimationFrame(tickFly)
    } else {
      // Plane reached target
      setPhase('idle')
      setPlanePos(null)
      setSentTo(f.tid)
      setMessage('')
      setTimeout(() => setBtnIcon(true), 150)
      setTimeout(() => setSentTo(null), 2600)
    }
  }

  function tickReturn(now) {
    const f = flyRef.current
    if (!f.start) f.start = now
    const raw = Math.min((now - f.start) / f.dur, 1)
    const t   = easeInOut(raw)
    setPlanePos({ x: qbez(t, f.x0, f.cx, f.tx), y: qbez(t, f.y0, f.cy, f.ty) })
    if (raw < 1) {
      rafRef.current = requestAnimationFrame(tickReturn)
    } else {
      setPhase('idle')
      setPlanePos(null)
      setTimeout(() => setBtnIcon(true), 80)
    }
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ── Derived visuals ────────────────────────────────────────────

  // Plane orientation
  const planeAngle = (() => {
    if (!planePos) return -45

    // During fly/return: point toward destination
    if ((phase === 'fly' || phase === 'return') && flyRef.current) {
      return aimAngle(planePos.x, planePos.y, flyRef.current.tx, flyRef.current.ty)
    }

    // During drag: point toward aimed chip
    if (phase === 'drag' && aimId && chipRefs.current[aimId]) {
      const { x: tx, y: ty } = chipCenter(chipRefs.current[aimId])
      return aimAngle(planePos.x, planePos.y, tx, ty)
    }

    return -45
  })()

  // Trajectory arc path (drag and fly phases)
  const trajectoryPath = (() => {
    if (!planePos || phase === 'idle' || phase === 'return') return null

    let tx, ty
    if (phase === 'fly' && flyRef.current) {
      tx = flyRef.current.tx; ty = flyRef.current.ty
    } else if (phase === 'drag' && aimId && chipRefs.current[aimId]) {
      const c = chipCenter(chipRefs.current[aimId])
      tx = c.x; ty = c.y
    } else return null

    const { cx, cy } = arcCtrl(planePos.x, planePos.y, tx, ty)
    return `M${planePos.x},${planePos.y} Q${cx},${cy} ${tx},${ty}`
  })()

  // Pullback line (shows drag charge: from plane back to button)
  const pullPath = (() => {
    if (phase !== 'drag' || !planePos || !origin) return null
    const dist = Math.hypot(planePos.x - origin.x, planePos.y - origin.y)
    if (dist < 10) return null
    return `M${planePos.x},${planePos.y} L${origin.x},${origin.y}`
  })()

  const showPlane = phase !== 'idle' && planePos

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>

      {/* SVG overlay: pullback line + trajectory arc */}
      {(pullPath || trajectoryPath) && (
        <svg className="overlay-svg">
          {/* Pull-back elastic line */}
          {pullPath && (
            <path
              d={pullPath}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1.5"
              strokeDasharray="2 4"
              strokeLinecap="round"
              opacity="0.18"
            />
          )}
          {/* Trajectory arc toward target */}
          {trajectoryPath && (
            <path
              d={trajectoryPath}
              fill="none"
              stroke="#1a1a1a"
              strokeWidth="1.5"
              strokeDasharray="5 6"
              strokeLinecap="round"
              opacity="0.3"
            />
          )}
        </svg>
      )}

      {/* Plane following cursor / flying */}
      {showPlane && (
        <div
          className="fly-plane"
          style={{
            left: planePos.x,
            top:  planePos.y,
            transform: `translate(-50%,-50%) rotate(${planeAngle}deg)`,
          }}
        >
          <PlaneIcon size={24} />
        </div>
      )}

      {/* User chips — top of screen */}
      <div className="chips-zone">
        {USERS.map((u, i) => (
          <div
            key={u.id}
            ref={el => { chipRefs.current[u.id] = el }}
            className={`chip${aimId === u.id && phase === 'drag' ? ' chip--aimed' : ''}`}
            data-i={i}
          >
            <span className="avatar" style={{ background: u.color }}>{u.initials}</span>
            <span className="uname">{u.name}</span>
            {sentTo === u.id && <span className="sent-tag">Отправлено ✓</span>}
          </div>
        ))}
      </div>

      <div className="mid-space" />

      {/* Floating input block — above bottom edge */}
      <div className="input-shell">
        <input
          className="msg-field"
          type="text"
          placeholder="Написать сообщение…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && message.trim()) setMessage('') }}
        />
        <button
          ref={btnRef}
          className={`send-btn${message.trim() ? '' : ' send-btn--dim'}`}
          aria-label="Зажми и перетащи к получателю"
          onPointerDown={onPointerDown}
          style={{ touchAction: 'none', cursor: message.trim() ? 'grab' : 'default' }}
        >
          <span
            className="btn-icon"
            style={{
              opacity:   btnIcon ? 1 : 0,
              transform: btnIcon ? 'scale(1)' : 'scale(0.2) rotate(-20deg)',
            }}
          >
            <PlaneIcon size={20} />
          </span>
        </button>
      </div>
    </div>
  )
}
