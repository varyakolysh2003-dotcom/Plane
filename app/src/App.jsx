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
      <path d="M22 2L15 22L11 13L2 9L22 2Z"  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function qbez(t, a, b, c) {
  const m = 1 - t
  return m * m * a + 2 * m * t * b + t * t * c
}
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// Arc control point (offset perpendicular to the line)
function arcCtrl(x0, y0, x1, y1, k = 0.3) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
  const dx = x1 - x0, dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  return { cx: mx - (dy / len) * len * k, cy: my + (dx / len) * len * k }
}

// Chip whose direction from origin best aligns with the cursor direction
function bestAim(chipRefs, ox, oy, cx, cy) {
  const dx = cx - ox, dy = cy - oy
  const len = Math.hypot(dx, dy)
  if (len < 6) return null
  let bestId = null, bestDot = -Infinity
  for (const [id, el] of Object.entries(chipRefs)) {
    if (!el) continue
    const r  = el.getBoundingClientRect()
    const ex = r.left + r.width  / 2 - ox
    const ey = r.top  + r.height / 2 - oy
    const el2 = Math.hypot(ex, ey)
    if (el2 < 1) continue
    const dot = (dx * ex + dy * ey) / (len * el2)
    if (dot > bestDot) { bestDot = dot; bestId = Number(id) }
  }
  return bestId
}

function chipCenter(el) {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export default function App() {
  const [message,  setMessage]  = useState('')
  const [phase,    setPhase]    = useState('idle') // idle | drag | fly
  const [flyPos,   setFlyPos]   = useState(null)   // plane position during fly only
  const [aimId,    setAimId]    = useState(null)
  const [aimAngle, setAimAngle] = useState(-45)    // rotation of icon inside button
  const [sentTo,   setSentTo]   = useState(null)
  const [btnIcon,  setBtnIcon]  = useState(true)

  const btnRef    = useRef(null)
  const chipRefs  = useRef({})
  const rafRef    = useRef(null)
  const flyRef    = useRef(null)
  const originRef = useRef(null)

  const getBtnCenter = () => {
    const r = btnRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }

  // ── Handlers ───────────────────────────────────────────────────

  const onPointerDown = useCallback((e) => {
    if (!message.trim()) return
    e.preventDefault()
    cancelAnimationFrame(rafRef.current)
    const center = getBtnCenter()
    if (!center) return
    originRef.current = center
    setPhase('drag')
    setBtnIcon(true)   // icon stays visible in button during drag
    setAimAngle(-45)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [message])

  const onPointerMove = useCallback((e) => {
    if (phase !== 'drag') return
    const origin = originRef.current
    if (!origin) return
    const { clientX: cx, clientY: cy } = e

    // Which chip does the drag direction aim at?
    const id = bestAim(chipRefs.current, origin.x, origin.y, cx, cy)
    setAimId(id)

    // Rotate the plane icon inside the button toward the aimed chip
    if (id && chipRefs.current[id]) {
      const { x: tx, y: ty } = chipCenter(chipRefs.current[id])
      const angle = Math.atan2(ty - origin.y, tx - origin.x) * (180 / Math.PI) + 45
      setAimAngle(angle)
    }
  }, [phase])

  const onPointerUp = useCallback((e) => {
    if (phase !== 'drag') return
    const origin = originRef.current
    const dist   = origin ? Math.hypot(e.clientX - origin.x, e.clientY - origin.y) : 0

    if (dist < 18 || !aimId || !chipRefs.current[aimId]) {
      // Cancel — snap icon back to default angle, stay in button
      setPhase('idle')
      setAimId(null)
      setAimAngle(-45)
      return
    }

    // Launch: plane exits button and flies to target chip
    const { x: tx, y: ty } = chipCenter(chipRefs.current[aimId])
    const { cx, cy }       = arcCtrl(origin.x, origin.y, tx, ty)

    flyRef.current = { x0: origin.x, y0: origin.y, cx, cy, tx, ty, tid: aimId, start: null, dur: 480 }
    setBtnIcon(false)   // hide icon in button once launched
    setAimId(null)
    setPhase('fly')
    setFlyPos({ x: origin.x, y: origin.y })
    rafRef.current = requestAnimationFrame(tick)
  }, [phase, aimId])

  function tick(now) {
    const f = flyRef.current
    if (!f.start) f.start = now
    const raw = Math.min((now - f.start) / f.dur, 1)
    const t   = easeInOut(raw)
    setFlyPos({ x: qbez(t, f.x0, f.cx, f.tx), y: qbez(t, f.y0, f.cy, f.ty) })
    if (raw < 1) {
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setPhase('idle')
      setFlyPos(null)
      setAimAngle(-45)
      setSentTo(f.tid)
      setMessage('')
      setTimeout(() => setBtnIcon(true), 160)
      setTimeout(() => setSentTo(null), 2600)
    }
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // ── Flying plane angle (during fly) ───────────────────────────
  const flyAngle = (() => {
    if (!flyPos || !flyRef.current) return -45
    const { tx, ty } = flyRef.current
    return Math.atan2(ty - flyPos.y, tx - flyPos.x) * (180 / Math.PI) + 45
  })()

  // ── Trajectory arc ─────────────────────────────────────────────
  const trajectoryPath = (() => {
    const origin = originRef.current
    // During drag: arc from button to aimed chip
    if (phase === 'drag' && origin && aimId && chipRefs.current[aimId]) {
      const { x: tx, y: ty } = chipCenter(chipRefs.current[aimId])
      const { cx, cy }       = arcCtrl(origin.x, origin.y, tx, ty)
      return `M${origin.x},${origin.y} Q${cx},${cy} ${tx},${ty}`
    }
    // During fly: shrinking arc from current plane to target
    if (phase === 'fly' && flyPos && flyRef.current) {
      const { tx, ty } = flyRef.current
      const { cx, cy } = arcCtrl(flyPos.x, flyPos.y, tx, ty)
      return `M${flyPos.x},${flyPos.y} Q${cx},${cy} ${tx},${ty}`
    }
    return null
  })()

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>

      {/* Trajectory overlay */}
      {trajectoryPath && (
        <svg className="overlay-svg">
          <path
            d={trajectoryPath}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="1.5"
            strokeDasharray="5 6"
            strokeLinecap="round"
            opacity={phase === 'drag' ? 0.3 : 0.18}
          />
        </svg>
      )}

      {/* Flying plane — only visible after launch, not during drag */}
      {phase === 'fly' && flyPos && (
        <div
          className="fly-plane"
          style={{
            left:      flyPos.x,
            top:       flyPos.y,
            transform: `translate(-50%,-50%) rotate(${flyAngle}deg)`,
          }}
        >
          <PlaneIcon size={24} />
        </div>
      )}

      {/* User chips */}
      <div className="chips-zone">
        {USERS.map((u, i) => (
          <div
            key={u.id}
            ref={el => { chipRefs.current[u.id] = el }}
            className={`chip${aimId === u.id ? ' chip--aimed' : ''}`}
            data-i={i}
          >
            <span className="avatar" style={{ background: u.color }}>{u.initials}</span>
            <span className="uname">{u.name}</span>
            {sentTo === u.id && <span className="sent-tag">Отправлено ✓</span>}
          </div>
        ))}
      </div>

      {/* Input sits in the vertical center of remaining space */}
      <div className="center-area">
        <div className="input-shell">
          <input
            className="msg-field"
            type="text"
            placeholder="Написать сообщение…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && message.trim()) setMessage('') }}
          />

          {/* Send button — plane stays inside and rotates during drag */}
          <button
            ref={btnRef}
            className={`send-btn${message.trim() ? '' : ' send-btn--dim'}`}
            aria-label="Зажми и тяни к получателю"
            onPointerDown={onPointerDown}
            style={{ touchAction: 'none', cursor: message.trim() ? 'grab' : 'default' }}
          >
            <span
              className="btn-icon"
              style={{
                opacity:   btnIcon ? 1 : 0,
                transform: btnIcon
                  ? `scale(1) rotate(${phase === 'drag' ? aimAngle : -45}deg)`
                  : 'scale(0.15) rotate(-20deg)',
              }}
            >
              <PlaneIcon size={20} />
            </span>
          </button>
        </div>
      </div>

      <div className="bottom-gap" />
    </div>
  )
}
