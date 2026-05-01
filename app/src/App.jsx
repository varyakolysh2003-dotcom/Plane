import { useState, useRef } from 'react'
import './App.css'

const USERS = [
  { id: 1, name: 'Алексей', initials: 'А', bg: '#ede9fe', fg: '#6d28d9', tilt: -4 },
  { id: 2, name: 'Мария',   initials: 'М', bg: '#fce7f3', fg: '#be185d', tilt:  2 },
  { id: 3, name: 'Саша',    initials: 'С', bg: '#dbeafe', fg: '#1d4ed8', tilt: -2 },
  { id: 4, name: 'Никита',  initials: 'Н', bg: '#dcfce7', fg: '#15803d', tilt:  4 },
]

function PaperPlane() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function buildPath(x1, y1, x2, y2) {
  const dist = Math.hypot(x2 - x1, y2 - y1)
  const mx   = (x1 + x2) / 2
  const my   = (y1 + y2) / 2 - dist * 0.35
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`
}

export default function App() {
  const [message, setMessage]     = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [dragPos, setDragPos]     = useState({ x: 0, y: 0 })
  const [btnCenter, setBtnCenter] = useState({ x: 0, y: 0 })
  const [toast, setToast]         = useState(null)

  const buttonRef = useRef(null)
  const cardRefs  = useRef({})
  const activeRef = useRef(false)

  function handlePointerDown(e) {
    e.preventDefault()
    buttonRef.current.setPointerCapture(e.pointerId)
    const r = buttonRef.current.getBoundingClientRect()
    const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    setBtnCenter(center)
    setDragPos({ x: e.clientX, y: e.clientY })
    activeRef.current = true
    setIsDragging(true)
  }

  function handlePointerMove(e) {
    if (!activeRef.current) return
    setDragPos({ x: e.clientX, y: e.clientY })
  }

  function handlePointerUp(e) {
    if (!activeRef.current) return
    activeRef.current = false
    setIsDragging(false)

    const { clientX: cx, clientY: cy } = e
    for (const user of USERS) {
      const el = cardRefs.current[user.id]
      if (!el) continue
      const r = el.getBoundingClientRect()
      if (cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom) {
        if (message.trim()) {
          setMessage('')
          setToast(`✓ Отправлено ${user.name}`)
          setTimeout(() => setToast(null), 2000)
        }
        return
      }
    }
  }

  const dx    = dragPos.x - btnCenter.x
  const dy    = dragPos.y - btnCenter.y
  const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 45

  return (
    <div className="app">

      {isDragging && (
        <svg className="trajectory" aria-hidden="true">
          <path
            d={buildPath(btnCenter.x, btnCenter.y, dragPos.x, dragPos.y)}
            fill="none"
            stroke="#1a1a1a"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinecap="round"
            opacity="0.45"
          />
        </svg>
      )}

      <div className="cards-row">
        {USERS.map(user => (
          <div
            key={user.id}
            ref={el => { cardRefs.current[user.id] = el }}
            className="user-card"
            style={{ transform: `rotate(${user.tilt}deg)` }}
          >
            <div className="user-avatar" style={{ background: user.bg, color: user.fg }}>
              {user.initials}
            </div>
            <span className="user-name">{user.name}</span>
          </div>
        ))}
      </div>

      <div className="input-block">
        <input
          className="message-input"
          type="text"
          placeholder="Type a message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <button
          ref={buttonRef}
          className="send-button"
          aria-label="Drag to send"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            background: isDragging ? 'transparent' : '#1a1a1a',
            boxShadow:  isDragging ? 'none' : '0 2px 8px rgba(0,0,0,0.18)',
            color:      isDragging ? '#1a1a1a' : '#fff',
            cursor:     isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'background 0.15s, box-shadow 0.15s',
          }}
        >
          <span
            style={{
              display:       'inline-flex',
              transform:     isDragging
                ? `translate(${dx}px, ${dy}px) rotate(${angle}deg)`
                : 'translate(0,0) rotate(0deg)',
              transition:    isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34,1.5,0.64,1)',
              pointerEvents: 'none',
            }}
          >
            <PaperPlane />
          </span>
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
