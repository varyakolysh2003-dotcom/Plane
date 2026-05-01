import { useState, useRef, useEffect } from 'react'
import './App.css'

const USERS = [
  { id: 1, name: 'Алексей', initials: 'А', bg: '#ede9fe', fg: '#6d28d9', tilt: -4 },
  { id: 2, name: 'Мария',   initials: 'М', bg: '#fce7f3', fg: '#be185d', tilt:  2 },
  { id: 3, name: 'Саша',    initials: 'С', bg: '#dbeafe', fg: '#1d4ed8', tilt: -2 },
  { id: 4, name: 'Никита',  initials: 'Н', bg: '#dcfce7', fg: '#15803d', tilt:  4 },
]

function PlaneIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// Quadratic bezier point at t ∈ [0,1]
function qbPt(p0, p1, p2, t) {
  const s = 1 - t
  return { x: s*s*p0.x + 2*s*t*p1.x + t*t*p2.x, y: s*s*p0.y + 2*s*t*p1.y + t*t*p2.y }
}

// Angle (deg) of the tangent at t
function qbAngle(p0, p1, p2, t) {
  const s = 1 - t
  const dx = 2*s*(p1.x-p0.x) + 2*t*(p2.x-p1.x)
  const dy = 2*s*(p1.y-p0.y) + 2*t*(p2.y-p1.y)
  return Math.atan2(dy, dx) * 180 / Math.PI + 45
}

// Control point for a gentle rightward arc
function ctrlPt(x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1, len = Math.hypot(dx, dy)
  if (len < 1) return { x: (x1+x2)/2, y: (y1+y2)/2 }
  const c = Math.min(len * 0.2, 55)
  return { x: (x1+x2)/2 + (-dy/len)*c, y: (y1+y2)/2 + (dx/len)*c }
}

// Ease in-out cubic
function easeInOut(t) {
  return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2
}

export default function App() {
  // phase: idle | dragging | flying | delivered
  const [phase, setPhase]           = useState('idle')
  const [message, setMessage]       = useState('')
  const [dragDelta, setDragDelta]   = useState({ x: 0, y: 0 })
  const [aimId, setAimId]           = useState(null)   // id of card being aimed at
  const [flyPlane, setFlyPlane]     = useState(null)   // {x,y,angle} fixed-position plane
  const [deliveredTo, setDeliveredTo] = useState(null) // user object
  const [bounceId, setBounceId]     = useState(null)

  // Refs for synchronous access inside event handlers / rAF
  const btnRef        = useRef(null)
  const cardRefs      = useRef({})
  const btnCenterRef  = useRef({ x: 0, y: 0 })
  const originRef     = useRef(null)
  const deltRef       = useRef({ x: 0, y: 0 })  // mirror of dragDelta
  const aimRef        = useRef(null)             // mirror of aim card
  const phaseRef      = useRef('idle')
  const animRef       = useRef(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => () => { if (animRef.current) cancelAnimationFrame(animRef.current) }, [])

  // Horizontal-nearest card to a given x position
  function nearestCard(px) {
    let best = null, bestD = Infinity
    for (const u of USERS) {
      const el = cardRefs.current[u.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      const d = Math.abs(px - cx)
      if (d < bestD) { bestD = d; best = { user: u, cx, cy } }
    }
    return best
  }

  function handlePointerDown(e) {
    if (phaseRef.current !== 'idle') return
    e.preventDefault()
    btnRef.current.setPointerCapture(e.pointerId)
    const r = btnRef.current.getBoundingClientRect()
    btnCenterRef.current = { x: r.left + r.width/2, y: r.top + r.height/2 }
    originRef.current    = { x: e.clientX, y: e.clientY }
    deltRef.current      = { x: 0, y: 0 }
    setDragDelta({ x: 0, y: 0 })
    setPhase('dragging')
  }

  function handlePointerMove(e) {
    if (phaseRef.current !== 'dragging') return
    const dx = e.clientX - originRef.current.x
    const dy = e.clientY - originRef.current.y
    const d  = { x: dx * 0.3, y: dy * 0.3 }
    deltRef.current = d
    setDragDelta(d)
    const nc = nearestCard(e.clientX)
    aimRef.current = nc
    setAimId(nc?.user.id ?? null)
  }

  function handlePointerUp(e) {
    if (phaseRef.current !== 'dragging') return
    originRef.current = null
    const nc = aimRef.current
    aimRef.current = null
    setAimId(null)

    if (!nc || !message.trim()) {
      // Return plane to button
      setPhase('idle')
      setDragDelta({ x: 0, y: 0 })
      deltRef.current = { x: 0, y: 0 }
      return
    }

    // Start flight along bezier
    const p0   = { x: btnCenterRef.current.x + deltRef.current.x, y: btnCenterRef.current.y + deltRef.current.y }
    const p2   = { x: nc.cx, y: nc.cy }
    const ctrl = ctrlPt(p0.x, p0.y, p2.x, p2.y)
    const targetUser = nc.user

    setDragDelta({ x: 0, y: 0 })
    deltRef.current = { x: 0, y: 0 }
    setFlyPlane({ x: p0.x, y: p0.y, angle: qbAngle(p0, ctrl, p2, 0) })
    setPhase('flying')

    const start = performance.now()
    const DURATION = 700

    function loop(now) {
      const raw = Math.min((now - start) / DURATION, 1)
      const t   = easeInOut(raw)
      const pt  = qbPt(p0, ctrl, p2, t)
      const ang = qbAngle(p0, ctrl, p2, t)
      setFlyPlane({ x: pt.x, y: pt.y, angle: ang })
      if (raw < 1) {
        animRef.current = requestAnimationFrame(loop)
      } else {
        // Arrived
        setFlyPlane(null)
        setPhase('delivered')
        setDeliveredTo(targetUser)
        setBounceId(targetUser.id)
        setMessage('')
        setTimeout(() => setBounceId(null), 600)
        setTimeout(() => { setDeliveredTo(null); setPhase('idle') }, 2000)
      }
    }
    animRef.current = requestAnimationFrame(loop)
  }

  // Derived values for rendering
  const planeX = btnCenterRef.current.x + dragDelta.x
  const planeY = btnCenterRef.current.y + dragDelta.y
  const dragDist = Math.hypot(dragDelta.x, dragDelta.y)
  const planeScale = phase === 'dragging' ? 1 + Math.min(dragDist / 65, 0.65) : 1

  // Plane angle during drag: always points toward targeted card (above), never flips down
  let dragAngle = -45 // default upper-right
  if (phase === 'dragging' && aimId) {
    const el = cardRefs.current[aimId]
    if (el) {
      const r = el.getBoundingClientRect()
      dragAngle = Math.atan2((r.top + r.height/2) - planeY, (r.left + r.width/2) - planeX) * 180/Math.PI + 45
    }
  }

  // Trajectory path
  let trajPath = null
  if (phase === 'dragging' && aimId) {
    const el = cardRefs.current[aimId]
    if (el) {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width/2, cy = r.top + r.height/2
      const cp = ctrlPt(planeX, planeY, cx, cy)
      trajPath = `M ${planeX} ${planeY} Q ${cp.x} ${cp.y} ${cx} ${cy}`
    }
  }

  const btnBgVisible = phase !== 'dragging' && phase !== 'flying'
  const btnPlaneVisible = phase === 'idle' || phase === 'delivered'

  return (
    <div className="app">

      {/* Full-screen SVG for trajectory */}
      {trajPath && (
        <svg className="overlay-svg" aria-hidden="true">
          <path d={trajPath} fill="none" stroke="#1a1a1a"
            strokeWidth="1.5" strokeDasharray="5 4"
            strokeLinecap="round" opacity="0.3" />
        </svg>
      )}

      {/* Plane that flies to the card after release */}
      {flyPlane && (
        <div className="plane-fly" style={{
          left: flyPlane.x, top: flyPlane.y,
          transform: `translate(-50%,-50%) rotate(${flyPlane.angle}deg)`,
        }}>
          <PlaneIcon size={22} />
        </div>
      )}

      {/* Toast */}
      {deliveredTo && (
        <div className="toast">Отправлено {deliveredTo.name}</div>
      )}

      {/* User cards */}
      <div className="cards-row">
        {USERS.map(u => (
          <div
            key={u.id}
            ref={el => { cardRefs.current[u.id] = el }}
            className={[
              'user-card',
              aimId === u.id   ? 'card-aim'    : '',
              bounceId === u.id ? 'card-bounce' : '',
            ].filter(Boolean).join(' ')}
            style={{ transform: `rotate(${u.tilt}deg)` }}
          >
            <div className="avatar" style={{ background: u.bg, color: u.fg }}>{u.initials}</div>
            <span className="uname">{u.name}</span>
          </div>
        ))}
      </div>

      {/* Input block */}
      <div className="input-block">
        <input
          className="msg-input"
          type="text"
          placeholder="Type a message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button
          ref={btnRef}
          className="send-btn"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label="Hold and drag to send"
          style={{
            background: btnBgVisible ? '#1a1a1a' : 'transparent',
            boxShadow:  btnBgVisible ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
            color:      btnBgVisible ? '#fff' : '#1a1a1a',
            cursor:     phase === 'dragging' ? 'grabbing' : 'grab',
            transition: 'background 0.15s, box-shadow 0.15s',
          }}
        >
          {btnPlaneVisible && <PlaneIcon size={20} />}
        </button>
      </div>

      {/* Dragging plane — floats at dampened drag position */}
      {phase === 'dragging' && (
        <div className="plane-drag" style={{
          left: planeX, top: planeY,
          transform: `translate(-50%,-50%) rotate(${dragAngle}deg) scale(${planeScale})`,
        }}>
          <PlaneIcon size={20} />
        </div>
      )}
    </div>
  )
}
