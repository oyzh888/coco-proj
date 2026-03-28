// API client for Coco AI backend
// Backend URL: configurable via env or defaults to public endpoint
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://cloth-backend.aitist.ai';

/**
 * Send a message to the AI agent
 * @param {string} message - Text message
 * @param {string|null} imageBase64 - Base64 encoded image (without data URI prefix)
 * @returns {Promise<{text: string, images: string[]}>}
 */
export async function sendMessage(message, imageBase64 = null) {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, image_base64: imageBase64 }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`API error ${response.status}: ${err}`);
  }

  return response.json();
}

/**
 * Send a message and stream the response via SSE
 * @param {string} message
 * @param {string|null} imageBase64
 * @param {function} onChunk - called with each text chunk
 * @returns {Promise<void>}
 */
export async function sendMessageStream(message, imageBase64 = null, onChunk) {
  const response = await fetch(`${BACKEND_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, image_base64: imageBase64 }),
  });

  if (!response.ok) {
    throw new Error(`Stream error ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data);
          const chunk = parsed.choices?.[0]?.delta?.content || '';
          if (chunk) onChunk(chunk);
        } catch {}
      }
    }
  }
}

export { BACKEND_URL };
