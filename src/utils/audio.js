export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

function playFile(src) {
  const audio = new Audio(src)
  audio.playsInline = true
  // Must be called directly from a user tap on iOS.
  return audio.play()
}

function playFileToEnd(src) {
  return new Promise((resolve, reject) => {
    const audio = new Audio(src)
    audio.playsInline = true
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error('audio error'))
    audio.play().catch(reject)
  })
}

function stripForAudio(text) {
  return String(text || '')
    .replace(/[?!.,;:…«»""''()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function speakWithTTS(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return Promise.resolve()
  }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'ka-GE'
  utter.rate = 0.9
  window.speechSynthesis.speak(utter)
  return Promise.resolve()
}

/** Play a Georgian example word. Call only from a click/tap handler. */
export function speakWord(text) {
  const clean = stripForAudio(text)
  if (!clean) return Promise.resolve()
  const src = `/audio/words/${wordAudioKey(clean)}.mp3`
  return playFile(src).catch(() => speakWithTTS(clean))
}

/**
 * Phrases: try full-phrase MP3, then play known word tokens in order,
 * then browser TTS as last resort.
 */
export async function speakPhrase(text) {
  const clean = stripForAudio(text)
  if (!clean) return

  try {
    await playFileToEnd(`/audio/words/${wordAudioKey(clean)}.mp3`)
    return
  } catch {
    // continue
  }

  const tokens = clean.split(/\s+/).filter(Boolean)
  if (tokens.length > 1) {
    try {
      for (const tok of tokens) {
        await playFileToEnd(`/audio/words/${wordAudioKey(tok)}.mp3`)
      }
      return
    } catch {
      // fall through to TTS
    }
  }

  return speakWithTTS(clean)
}

/** Single Mkhedruli letter sound (files live in /audio/, not /audio/words/). */
export function speakLetter(letter) {
  const src = `/audio/${wordAudioKey(letter)}.mp3`
  return playFile(src).catch(() => speakWithTTS(letter))
}

export function playCorrectSound() {
  playFile('/audio/correct.wav').catch(() => {})
}

export function playWrongSound() {
  playFile('/audio/wrong.wav').catch(() => {})
}
