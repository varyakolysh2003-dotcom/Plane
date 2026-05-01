import { useState, useRef } from 'react'
import './App.css'

function PaperPlane({ style }) {
  return (
    <svg
      style={style}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const USERS = [
  { id: 1, name: 'Алексей', initials: 'А', bg: '#ede9fe', fg: '#6d28d9', tilt: -4 },
  { id: 2, name: 'Мария',   initials: 'М', bg: '#fce7f3', fg: '#be185d', tilt:  2 },
  { id: 3, name: 'Саша',    initials: 'С', bg: '#dbeafe', fg: '#1d4ed8', tilt: -2 },
  { id: 4, name: 'Никита',  initials: 'Н', bg: '#dcfce7', fg: '#15803d', tilt:  4 },
]

function UserCard({ user, index }) {
  return (
    // Outer wrapper holds the tilt — isolated from the hover animation
    <div
      className="user-card-tilt"
      style={{
        transform: `rotate(${user.tilt}deg)`,
        animationDelay: `${index * 0.07}s`,
      }}
    >
      <div className="user-card">
        <div className="user-avatar" style={{ background: user.bg, color: user.fg }}>
          {user.initials}
        </div>
        <span className="user-name">{user.name}</span>
      </div>
    </div>
  )
}

export default function App() {
  const [message, setMessage] = useState('')
  const [drag, setDrag]       = useState(null)
  const buttonRef             = useRef(null)
  const originRef             = useRef(null)

  function handleSend() {
    if (message.trim()) setMessage('')
  }

  function handlePointerDown(e) {
    e.preventDefault()
    buttonRef.current.setPointerCapture(e.pointerId)
    originRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ x: 0, y: 0 })
  }

  function handlePointerMove(e) {
    if (!originRef.current) return
    const MAX = 55
    const dx  = e.clientX - originRef.current.x
    const dy  = e.clientY - originRef.current.y
    setDrag({
      x: Math.max(-MAX, Math.min(MAX, dx)),
      y: Math.max(-MAX, Math.min(MAX, dy)),
    })
  }

  function handlePointerUp() {
    if (!originRef.current) return
    const { x, y } = drag
    originRef.current = null
    setDrag(null)
    if (Math.hypot(x, y) > 28) handleSend()
  }

  const isDragging = drag !== null

  // SVG plane nose points upper-right (~-45°). Add 45° offset so it aligns with drag angle.
  const planeAngle = isDragging ? Math.atan2(drag.y, drag.x) * (180 / Math.PI) + 45 : 0
  const planeX     = isDragging ? drag.x * 0.45 : 0
  const planeY     = isDragging ? drag.y * 0.45 : 0

  return (
    <div className="app">
      <div className="chat-area">
        <div className="user-cards">
          {USERS.map((user, i) => (
            <UserCard key={user.id} user={user} index={i} />
          ))}
        </div>
      </div>

      <div className="input-bar">
        <div className="input-wrapper">
          <input
            className="message-input"
            type="text"
            placeholder="Type a message…"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
          />
          <button
            ref={buttonRef}
            className={`send-button${isDragging ? ' is-dragging' : ''}`}
            aria-label="Send message"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={isDragging ? undefined : handleSend}
          >
            <PaperPlane
              style={{
                transform:  `translate(${planeX}px, ${planeY}px) rotate(${planeAngle}deg)`,
                transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.5, 0.64, 1)',
                color:      isDragging ? '#1a1a1a' : 'currentColor',
              }}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
