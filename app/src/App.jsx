import { useState } from 'react'
import './App.css'

function PaperPlane() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function App() {
  const [message, setMessage] = useState('')

  function handleSend() {
    if (message.trim()) setMessage('')
  }

  return (
    <div className="app">
      <div className="chat-area">
        <p className="empty-state">No messages yet</p>
      </div>

      <div className="input-bar">
        <input
          className="message-input"
          type="text"
          placeholder="Type a message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
        />
        <button className="send-button" aria-label="Send message" onClick={handleSend}>
          <PaperPlane />
        </button>
      </div>
    </div>
  )
}
