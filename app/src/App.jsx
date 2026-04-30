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
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Quadratic bezier
function qbez(t, a, b, c) {
  const m = 1 - t
  return m * m * a + 2 * m * t * b + t * t * c
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

// Control point offset for a natural arc
function ctrl(x0, y0, x1, y1) {
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const k = len * 0.22
  return { cx: mx - (dy / len) * k, cy: my + (dx / len) * k }
}

export default function App() {
  const [message, setMessage] = useState('')
  const [phase, setPhase]     = useState('idle') // 'idle' | 'drag' | 'fly'
  const [planePos, setPlanePos] = useState(null)
  const [origin,   setOrigin]   = useState(null)
  const [hovered,  setHovered]  = useState(null)
  const [sentTo,   setSentTo]   = useState(null)
  const [btnIcon,  setBtnIcon]  = useState(true)

  const btnRef     = useRef(null)
  const chipRefs   = useRef({})
  const rafRef     = useRef(null)
  const flyRef     = useRef(null)

  const getBtnCenter = () => {
    const r = btnRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }

  const chipAt = (x, y) => {
    for (const [id, el] of Object.entries(chipRefs.current)) {
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number(id)
    }
    return null
  }

  const onPointerDown = useCallback((e) => {
    if (!message.trim()) return
    e.preventDefault()
    const center = getBtnCenter()
    if (!center) return
    setOrigin(center)
    setPlanePos(center)
    setPhase('drag')
    setBtnIcon(false)
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [message])

  const onPointerMove = useCallback((e) => {
    if (phase !== 'drag') return
    const x = e.clientX, y = e.clientY
    setPlanePos({ x, y })
    setHovered(chipAt(x, y))
  }, [phase])

  const onPointerUp = useCallback((e) => {
    if (phase !== 'drag') return
    setPhase('idle')
    setHovered(null)
    const x = e.clientX, y = e.clientY
    const tid = chipAt(x, y)

    if (tid !== null && message.trim()) {
      const r = chipRefs.current[tid].getBoundingClientRect()
      const tx = r.left + r.width / 2
      const ty = r.top + r.height / 2
      const { cx, cy } = ctrl(x, y, tx, ty)
      flyRef.current = { x0: x, y0: y, cx, cy, tx, ty, tid, start: null, dur: 380 }
      setPhase('fly')

      const tick = (now) => {
        const f = flyRef.current
        if (!f.start) f.start = now
        const raw = Math.min((now - f.start) / f.dur, 1)
        const t   = easeInOut(raw)
        setPlanePos({ x: qbez(t, f.x0, f.cx, f.tx), y: qbez(t, f.y0, f.cy, f.ty) })
        if (raw < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setPhase('idle')
          setPlanePos(null)
          setSentTo(f.tid)
          setMessage('')
          setTimeout(() => setBtnIcon(true), 140)
          setTimeout(() => setSentTo(null), 2500)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      setPlanePos(null)
      setTimeout(() => setBtnIcon(true), 80)
    }
  }, [phase, message])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  // Trail SVG path (drag phase only)
  const trailPath = phase === 'drag' && origin && planePos
    ? (() => {
        const { cx, cy } = ctrl(origin.x, origin.y, planePos.x, planePos.y)
        return `M${origin.x},${origin.y} Q${cx},${cy} ${planePos.x},${planePos.y}`
      })()
    : null

  // Plane rotation angle
  const planeAngle = (() => {
    if (!planePos) return -45
    if (phase === 'fly' && flyRef.current) {
      const { tx, ty } = flyRef.current
      return Math.atan2(ty - planePos.y, tx - planePos.x) * (180 / Math.PI) + 45
    }
    if (origin) {
      const dx = planePos.x - origin.x
      const dy = planePos.y - origin.y
      return Math.hypot(dx, dy) < 3 ? -45 : Math.atan2(dy, dx) * (180 / Math.PI) + 45
    }
    return -45
  })()

  const showPlane = phase !== 'idle' && planePos

  return (
    <div className="app" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>

      {/* Curved dotted trail */}
      {trailPath && (
        <svg className="trail-svg">
          <path
            d={trailPath}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="1.5"
            strokeDasharray="4 5"
            strokeLinecap="round"
            opacity="0.22"
          />
        </svg>
      )}

      {/* Floating plane */}
      {showPlane && (
        <div
          className="fly-plane"
          style={{
            left: planePos.x,
            top:  planePos.y,
            transform: `translate(-50%,-50%) rotate(${planeAngle}deg)`,
          }}
        >
          <PlaneIcon size={22} />
        </div>
      )}

      {/* User chips */}
      <div className="chips-zone">
        {USERS.map((u, i) => (
          <div
            key={u.id}
            ref={el => { chipRefs.current[u.id] = el }}
            className={`chip${hovered === u.id ? ' chip--over' : ''}`}
            data-i={i}
          >
            <span className="avatar" style={{ background: u.color }}>{u.initials}</span>
            <span className="uname">{u.name}</span>
            {sentTo === u.id && <span className="sent-tag">Отправлено ✓</span>}
          </div>
        ))}
      </div>

      <div className="mid-space" />

      {/* Floating input block */}
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
              transform: btnIcon ? 'scale(1)' : 'scale(0.3) rotate(-30deg)',
            }}
          >
            <PlaneIcon size={20} />
          </span>
        </button>
      </div>
    </div>
  )
}
