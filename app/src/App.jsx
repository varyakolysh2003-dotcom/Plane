import { useState, useRef, useEffect } from 'react'
import './App.css'

const USERS = [
  { id: 1, name: 'Алексей', initials: 'А', bg: '#ede9fe', fg: '#6d28d9', tilt: -4 },
  { id: 2, name: 'Мария',   initials: 'М', bg: '#fce7f3', fg: '#be185d', tilt:  2 },
  { id: 3, name: 'Саша',    initials: 'С', bg: '#dbeafe', fg: '#1d4ed8', tilt: -2 },
  { id: 4, name: 'Никита',  initials: 'Н', bg: '#dcfce7', fg: '#15803d', tilt:  4 },
]

// ion_paper-plane-sharp (Ionicons v5, filled, 512×512)
function PlaneIcon({ size = 20, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true" style={style}>
      <path d="M476.59 227.05l-.16-.07L49.35 49.84A23.56 23.56 0 0027.14 52 24.65 24.65 0 0016 72.59v113.29a24 24 0 0019.52 23.57l232.93 43.07a4 4 0 010 7.86L35.53 303.45A24 24 0 0016 327v113.38C16 454.41 26.52 464 36.9 464a23.43 23.43 0 009.4-2l.2-.1 427.09-174.38c.14-.06.26-.13.39-.19A23.84 23.84 0 00496 265.95a24 24 0 00-19.41-38.9z"/>
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
  return Math.atan2(dy, dx) * 180 / Math.PI
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
  const inputBlockRef = useRef(null)
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

    // Start flight from the plane's visual center (center of the input block)
    const ibr  = inputBlockRef.current.getBoundingClientRect()
    const p0   = { x: ibr.left + ibr.width / 2, y: ibr.top + ibr.height / 2 }
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
  const dragDist = Math.hypot(dragDelta.x, dragDelta.y)
  // Scale grows from 1× up to 1.8× as user drags further
  const planeScale = 1 + Math.min(dragDist / 60, 0.8)

  // Plane angle during drag: always points toward the aimed card (above), never flips down
  let dragAngle = -45 // default upper-right
  if (phase === 'dragging' && aimId) {
    const el = cardRefs.current[aimId]
    if (el && inputBlockRef.current) {
      const ibr = inputBlockRef.current.getBoundingClientRect()
      const ox  = ibr.left + ibr.width / 2
      const oy  = ibr.top  + ibr.height / 2
      const r   = el.getBoundingClientRect()
      dragAngle = Math.atan2((r.top + r.height/2) - oy, (r.left + r.width/2) - ox) * 180/Math.PI + 45
    }
  }

  // Trajectory: originates from the input block center (where the plane is shown)
  let trajPath = null
  if (phase === 'dragging' && aimId && inputBlockRef.current) {
    const el = cardRefs.current[aimId]
    if (el) {
      const ibr = inputBlockRef.current.getBoundingClientRect()
      const ox  = ibr.left + ibr.width / 2
      const oy  = ibr.top  + ibr.height / 2
      const r   = el.getBoundingClientRect()
      const cx  = r.left + r.width / 2, cy = r.top + r.height / 2
      const cp  = ctrlPt(ox, oy, cx, cy)
      trajPath  = `M ${ox} ${oy} Q ${cp.x} ${cp.y} ${cx} ${cy}`
    }
  }

  const isDragging = phase === 'dragging'
  const btnBgVisible    = phase !== 'dragging' && phase !== 'flying'
  const btnPlaneVisible = phase === 'idle' || phase === 'delivered'

  return (
    <div className="app">

      {/* Trajectory SVG — always mounted so opacity transition fires on show/hide */}
      <svg
        className="overlay-svg"
        style={{ opacity: phase === 'dragging' && aimId ? 1 : 0 }}
        aria-hidden="true"
      >
        {trajPath && (
          <path d={trajPath} fill="none" stroke="#1a1a1a"
            strokeWidth="1.5" strokeDasharray="5 4"
            strokeLinecap="round" opacity="0.35" />
        )}
      </svg>

      {/* Plane that flies to the card after release */}
      {flyPlane && (
        <div className="plane-fly" style={{
          left: flyPlane.x, top: flyPlane.y,
          transform: `translate(-50%,-50%) rotate(${flyPlane.angle}deg)`,
        }}>
          <PlaneIcon size={34} />
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
              aimId === u.id    ? 'card-aim'    : '',
              bounceId === u.id ? 'card-bounce' : '',
            ].filter(Boolean).join(' ')}
            style={{ transform: `rotate(${u.tilt}deg)` }}
          >
            <div className="avatar" style={{ background: u.bg, color: u.fg }}>{u.initials}</div>
            <span className="uname">{u.name}</span>
          </div>
        ))}
      </div>

      {/* Input block — fades out during drag; centered plane takes its place */}
      <div
        ref={inputBlockRef}
        className={`input-block${isDragging ? ' input-block--drag' : ''}`}
      >
        <div className="input-row">
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
              cursor:     isDragging ? 'grabbing' : 'grab',
              transition: 'background 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            }}
          >
            {/* Always in DOM — fades in/out via CSS class */}
            <span className={`send-btn-icon${btnPlaneVisible ? '' : ' send-btn-icon--hidden'}`}>
              <PlaneIcon size={30} />
            </span>
          </button>
        </div>

        {/* Centered plane — fades in and scales up during drag */}
        <div className="input-plane" aria-hidden="true">
          <PlaneIcon size={30} style={{
            transform: `rotate(${dragAngle}deg) scale(${isDragging ? planeScale : 1})`,
            transition: isDragging ? 'transform 0.06s ease-out' : 'transform 0.25s ease-in-out',
          }} />
        </div>
      </div>
    </div>
  )
}
