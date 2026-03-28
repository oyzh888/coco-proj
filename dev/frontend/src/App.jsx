import { useState, useRef } from 'react'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://cloth-backend.aitist.ai'

const MOODS = ['Happy', 'Casual', 'Professional', 'Date Night', 'Sporty', 'Cozy']
const SCENES = ['Daily', 'Work', 'Outdoor', 'Party', 'Gym', 'Date', 'Travel']

// Demo closet: a small placeholder base64 (1x1 transparent, will show as broken — use fetch instead)
const DEMO_CLOSET_URL = 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&q=80'

export default function App() {
  const [location, setLocation] = useState('')
  const [mood, setMood] = useState('Casual')
  const [scene, setScene] = useState('Daily')
  const [closetImage, setClosetImage] = useState(null)     // { preview, base64 }
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)               // { text, images }
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef()

  // Convert File to base64 (without data URI prefix)
  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const handleImageFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const b64 = await fileToBase64(file)
    setClosetImage({ preview: URL.createObjectURL(file), base64: b64 })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleImageFile(file)
  }

  const loadDemoData = async () => {
    setLocation('San Francisco, CA')
    setMood('Casual')
    setScene('Daily')
    // Fetch demo image and convert to base64
    try {
      const resp = await fetch(DEMO_CLOSET_URL)
      const blob = await resp.blob()
      const file = new File([blob], 'demo-closet.jpg', { type: blob.type })
      await handleImageFile(file)
    } catch {
      setClosetImage({ preview: null, base64: null })
    }
  }

  const getOutfit = async () => {
    if (!location.trim()) {
      setError('Please enter a location')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const resp = await fetch(`${BACKEND_URL}/api/outfit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location,
          mood,
          scene,
          closet_image_base64: closetImage?.base64 || null,
        }),
      })
      if (!resp.ok) throw new Error(`API error ${resp.status}`)
      const data = await resp.json()
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <h1>🥥 Coco AI</h1>
        <p className="app-subtitle">Your personal AI stylist</p>
      </header>

      <div className="app-layout">
        {/* ── Left Panel: Inputs ── */}
        <div className="input-panel">
          <h2 className="panel-title">Your Details</h2>

          {/* Location */}
          <div className="field">
            <label>📍 Location</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="San Francisco, CA"
              className="text-input"
            />
          </div>

          {/* Mood */}
          <div className="field">
            <label>😊 Mood</label>
            <select value={mood} onChange={e => setMood(e.target.value)} className="select-input">
              {MOODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Closet Upload */}
          <div className="field">
            <label>👗 My Closet</label>
            <div
              className={`closet-upload ${dragging ? 'dragging' : ''} ${closetImage ? 'has-image' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              {closetImage?.preview ? (
                <img src={closetImage.preview} alt="closet" className="closet-preview" />
              ) : (
                <div className="upload-placeholder">
                  <span className="upload-icon">📷</span>
                  <span>Click or drag to upload closet photo</span>
                  <span className="upload-hint">JPG, PNG supported</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => handleImageFile(e.target.files[0])}
            />
            {closetImage && (
              <button className="remove-btn" onClick={() => setClosetImage(null)}>✕ Remove photo</button>
            )}
          </div>

          {/* Scene */}
          <div className="field">
            <label>🎭 Scene</label>
            <select value={scene} onChange={e => setScene(e.target.value)} className="select-input">
              {SCENES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          {/* Buttons */}
          <div className="button-group">
            <button
              className="btn-primary"
              onClick={getOutfit}
              disabled={loading}
            >
              {loading ? '⏳ Generating...' : '✨ Get Outfit'}
            </button>
            <button className="btn-secondary" onClick={loadDemoData} disabled={loading}>
              🎲 Load Demo
            </button>
          </div>

          {error && <div className="error-msg">⚠️ {error}</div>}
        </div>

        {/* ── Right Panel: Output ── */}
        <div className="output-panel">
          <h2 className="panel-title">Your Outfit</h2>

          {loading && (
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Styling your look...</p>
              <p className="loading-sub">Consulting stylist + generating image</p>
            </div>
          )}

          {!loading && !result && (
            <div className="empty-state">
              <span className="empty-icon">👗</span>
              <p>Your outfit recommendation will appear here ✨</p>
              <p className="empty-sub">Fill in your details and tap Get Outfit</p>
            </div>
          )}

          {!loading && result && (
            <div className="result">
              {result.images?.length > 0 && (
                <img
                  src={`data:image/png;base64,${result.images[0]}`}
                  alt="Generated outfit"
                  className="outfit-image"
                />
              )}
              <div className="outfit-text">
                {result.text.split('\n').map((line, i) => (
                  <p key={i} className={line.startsWith('#') ? 'outfit-heading' : ''}>{line.replace(/^#+\s*/, '')}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
