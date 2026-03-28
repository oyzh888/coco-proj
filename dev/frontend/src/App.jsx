import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { sendMessage } from './api.js'

/**
 * Coco AI - Main Chat Application
 * A clean chat interface that communicates with the FastAPI backend.
 */

// A single message in the chat history
function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`message ${isUser ? 'user' : 'assistant'}`}>
      <div className="bubble">
        {/* Show image if user attached one */}
        {msg.imagePreview && (
          <img
            className="message-image-preview"
            src={msg.imagePreview}
            alt="Uploaded"
          />
        )}
        {/* Render text as markdown */}
        {msg.text && (
          <ReactMarkdown>{msg.text}</ReactMarkdown>
        )}
        {/* Render any response images */}
        {msg.images && msg.images.map((b64, i) => (
          <img
            key={i}
            className="response-image"
            src={`data:image/png;base64,${b64}`}
            alt={`AI generated image ${i + 1}`}
          />
        ))}
      </div>
    </div>
  )
}

// Loading spinner
function Spinner() {
  return (
    <div className="message assistant">
      <div className="bubble loading">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [imageFile, setImageFile] = useState(null)      // File object
  const [imagePreview, setImagePreview] = useState(null) // data URL for preview
  const [imageBase64, setImageBase64] = useState(null)  // pure base64 for API
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Handle image file selection
  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    loadImage(file)
  }

  function loadImage(file) {
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      setImagePreview(dataUrl)
      // Strip "data:image/...;base64," prefix to get pure base64
      const base64 = dataUrl.split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  // Handle drag-and-drop on the whole page
  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      loadImage(file)
    }
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    setImageBase64(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSend() {
    const text = input.trim()
    if (!text && !imageBase64) return
    if (loading) return

    // Optimistically add user message
    const userMsg = {
      role: 'user',
      text,
      imagePreview,
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    clearImage()
    setError(null)
    setLoading(true)

    try {
      const { text: responseText, images } = await sendMessage(text, imageBase64)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: responseText,
        images,
      }])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Send on Enter (Shift+Enter for newline)
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="app"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="header">
        <span className="logo">🥥</span>
        <h1 className="title">Coco AI</h1>
        <span className="subtitle">Powered by OpenClaw</span>
      </header>

      {/* Chat window */}
      <main className="chat-window">
        {messages.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🥥</span>
            <p>Send a message to get started.</p>
            <p className="hint">You can also attach an image!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && <Spinner />}
        {error && (
          <div className="error-banner">
            ⚠️ {error}
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <footer className="input-area">
        {/* Image preview */}
        {imagePreview && (
          <div className="image-preview-strip">
            <img src={imagePreview} alt="Preview" className="preview-thumb" />
            <button className="remove-image" onClick={clearImage} title="Remove image">✕</button>
          </div>
        )}

        <div className="input-row">
          {/* Image upload button */}
          <button
            className="icon-btn upload-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach image"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Text input */}
          <textarea
            ref={textareaRef}
            className="text-input"
            placeholder="Message Coco AI… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />

          {/* Send button */}
          <button
            className={`send-btn ${loading ? 'disabled' : ''}`}
            onClick={handleSend}
            disabled={loading}
            title="Send message"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
      </footer>
    </div>
  )
}
