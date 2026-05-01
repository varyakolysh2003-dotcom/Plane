import { useState, useRef } from 'react'
import './App.css'

function PaperPlane() {
  return (
    <svg
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

export default function App() {
  const [message, setMessage] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [planeX, setPlaneX] = useState(0)
  const [planeY, setPlaneY] = useState(0)
  const [planeAngle, setPlaneAngle] = useState(0)

  // useRef so handlePointerMove/Up always read the latest origin, never stale
  const originRef  = useRef(null)
  const buttonRef  = useRef(null)

  function handleSend() {
    if (message.trim()) setMessage('')
  }

  function handlePointerDown(e) {
    e.preventDefault()
    buttonRef.current.setPointerCapture(e.pointerId)
    originRef.current = { x: e.clientX, y: e.clientY }
    setIsDragging(true)
    setPlaneX(0)
    setPlaneY(0)
    setPlaneAngle(0)
  }

  function handlePointerMove(e) {
    if (!originRef.current) return
    const MAX = 60
    const dx = Math.max(-MAX, Math.min(MAX, e.clientX - originRef.current.x))
    const dy = Math.max(-MAX, Math.min(MAX, e.clientY - originRef.current.y))
    // Plane nose is upper-right by default; +45° aligns it with the drag vector
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 45
    setPlaneX(dx * 0.65)
    setPlaneY(dy * 0.65)
    setPlaneAngle(angle)
  }

  function handlePointerUp(e) {
    if (!originRef.current) return
    const dx = planeX / 0.65
    const dy = planeY / 0.65
    const dist = Math.hypot(dx, dy)
    originRef.current = null
    setIsDragging(false)
    setPlaneX(0)
    setPlaneY(0)
    setPlaneAngle(0)
    if (dist > 25) handleSend()
  }

  return (
    <div className="app">
      <div className="chat-area">
        <div className="user-cards">
          {USERS.map((user, i) => (
            <div
              key={user.id}
              className="user-card-wrap"
              style={{ transform: `rotate(${user.tilt}deg)`, animationDelay: `${i * 0.08}s` }}
            >
              <div className="user-card">
                <div className="user-avatar" style={{ background: user.bg, color: user.fg }}>
                  {user.initials}
                </div>
                <span className="user-name">{user.name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="input-bar">
        {/* Inline style as fallback in case CSS is overridden */}
        <div className="input-wrapper" style={{ maxWidth: '500px', width: '100%' }}>
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
            className="send-button"
            aria-label="Send message"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleSend}
            style={{
              // Inline style overrides CSS class — background gone while dragging
              background:  isDragging ? 'transparent' : '#1a1a1a',
              boxShadow:   isDragging ? 'none'        : '0 2px 8px rgba(0,0,0,0.15)',
              color:       isDragging ? '#1a1a1a'     : '#fff',
              transition:  isDragging ? 'none' : 'background 0.15s, box-shadow 0.15s',
            }}
          >
            <span
              style={{
                display:    'inline-flex',
                transform:  `translate(${planeX}px, ${planeY}px) rotate(${planeAngle}deg)`,
                transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.34, 1.5, 0.64, 1)',
              }}
            >
              <PaperPlane />
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
