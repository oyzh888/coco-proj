/**
 * Coco AI - API Client
 * Communicates with the FastAPI backend.
 */

// Backend base URL — override via VITE_BACKEND_URL env var or use default
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/**
 * Send a message (with optional image) to the Coco AI backend.
 *
 * @param {string} message - The user's text message
 * @param {string|null} imageBase64 - Base64-encoded image (without data URI prefix), or null
 * @returns {Promise<{ text: string, images: string[] }>}
 */
export async function sendMessage(message, imageBase64 = null) {
  const body = { message }
  if (imageBase64) {
    body.image_base64 = imageBase64
  }

  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Backend error ${response.status}: ${errorText}`)
  }

  return response.json() // { text, images }
}

/**
 * Send a message with streaming response via SSE.
 *
 * @param {string} message
 * @param {string|null} imageBase64
 * @param {(chunk: string) => void} onText - Called for each text chunk
 * @param {(base64: string) => void} onImage - Called for each image
 * @returns {Promise<void>}
 */
export async function sendMessageStream(message, imageBase64, onText, onImage) {
  const body = { message }
  if (imageBase64) {
    body.image_base64 = imageBase64
  }

  const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Backend error ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete line in buffer

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim()
      if (!raw || raw === '[DONE]') continue
      try {
        const event = JSON.parse(raw)
        if (event.type === 'text') onText(event.content)
        else if (event.type === 'image') onImage(event.content)
      } catch {
        // ignore parse errors
      }
    }
  }
}
