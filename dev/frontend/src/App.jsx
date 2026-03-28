import { useState, useRef } from 'react'
import './App.css'

const DEMO_IMAGE_URL = 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=400&q=80'

function App() {
  const [location, setLocation] = useState('')
  const [mood, setMood] = useState('')
  const [scene, setScene] = useState('')
  const [closetImage, setClosetImage] = useState(null) // base64 without prefix
  const [closetPreview, setClosetPreview] = useState(null) // full data URL for preview
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      setClosetPreview(dataUrl)
      // Strip data:image/...;base64, prefix
      const base64 = dataUrl.split(',')[1]
      setClosetImage(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e) => {
    handleImageFile(e.target.files[0])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleImageFile(e.dataTransfer.files[0])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const loadDemoData = async () => {
    setLocation('San Francisco, CA')
    setMood('Casual')
    setScene('Daily')
    // Load demo image as base64
    try {
      const res = await fetch(DEMO_IMAGE_URL)
      const blob = await res.blob()
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target.result
        setClosetPreview(dataUrl)
        setClosetImage(dataUrl.split(',')[1])
      }
      reader.readAsDataURL(blob)
    } catch {
      // If demo image fails, just set a placeholder indicator
      setClosetPreview(null)
      setClosetImage(null)
    }
  }

  const getOutfit = async () => {
    if (!location && !mood && !scene) {
      setError('Please fill in at least one field before generating.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('https://cloth-backend.aitist.ai/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `You are a fashion stylist AI. Generate a complete outfit recommendation.\n\nUser details:\n- Location: ${location || 'Not specified'}\n- Mood: ${mood || 'Not specified'}\n- Scene/Occasion: ${scene || 'Not specified'}\n\nBased on the closet photo provided (if any), suggest 1 complete outfit with specific items, why it works, and styling tips.`,
          image_base64: closetImage || null
        })
      })
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }
      const data = await response.json()
      setResult(data)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🥥 Coco AI</h1>
        <p className="app-subtitle">AI-powered outfit recommendations</p>
      </header>

      <div className="app-layout">
        {/* Left Panel - Inputs */}
        <div className="input-panel">
          <h2 className="panel-title">Your Style Profile</h2>

          <div className="form-group">
            <label>📍 Location</label>
            <input
              type="text"
              className="form-input"
              placeholder="San Francisco, CA"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>😊 Mood</label>
            <select
              className="form-select"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            >
              <option value="">Select mood...</option>
              <option value="Happy">Happy</option>
              <option value="Casual">Casual</option>
              <option value="Professional">Professional</option>
              <option value="Date Night">Date Night</option>
              <option value="Sporty">Sporty</option>
              <option value="Cozy">Cozy</option>
            </select>
          </div>

          <div className="form-group">
            <label>👗 My Closet</label>
            <div
              className={`closet-upload ${isDragging ? 'dragging' : ''} ${closetPreview ? 'has-image' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {closetPreview ? (
                <div className="closet-preview">
                  <img src={closetPreview} alt="Closet preview" />
                  <div className="closet-overlay">
                    <span>Click to change</span>
                  </div>
                </div>
              ) : (
                <div className="closet-placeholder">
                  <span className="upload-icon">📤</span>
                  <span>Click or drag & drop</span>
                  <span className="upload-hint">Upload a photo of your closet or outfit</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          <div className="form-group">
            <label>🎭 Scene</label>
            <select
              className="form-select"
              value={scene}
              onChange={(e) => setScene(e.target.value)}
            >
              <option value="">Select scene...</option>
              <option value="Daily">Daily</option>
              <option value="Work">Work</option>
              <option value="Outdoor">Outdoor</option>
              <option value="Party">Party</option>
              <option value="Gym">Gym</option>
              <option value="Date">Date</option>
              <option value="Travel">Travel</option>
            </select>
          </div>

          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={getOutfit}
              disabled={loading}
            >
              {loading ? '⏳ Generating...' : '✨ Get Outfit'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={loadDemoData}
              disabled={loading}
            >
              🎲 Load Demo Data
            </button>
          </div>
        </div>

        {/* Right Panel - Output */}
        <div className="output-panel">
          <h2 className="panel-title">Your Outfit Recommendation</h2>

          <div className="output-content">
            {!loading && !result && !error && (
              <div className="empty-state">
                <span className="empty-icon">👗</span>
                <p>Your outfit recommendation will appear here ✨</p>
                <p className="empty-hint">Fill in your style profile and click "Get Outfit"</p>
              </div>
            )}

            {loading && (
              <div className="loading-state">
                <div className="loading-spinner"></div>
                <p>Generating your outfit...</p>
              </div>
            )}

            {error && (
              <div className="error-state">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}

            {result && !loading && (
              <div className="result-content">
                {result.images && result.images.length > 0 && (
                  <img
                    className="outfit-image"
                    src={`data:image/png;base64,${result.images[0]}`}
                    alt="Outfit recommendation"
                  />
                )}
                <div className="outfit-text">
                  {result.text}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
