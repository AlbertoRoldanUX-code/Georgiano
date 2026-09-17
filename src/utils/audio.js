export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

let currentAudio = null

export function stopAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause()
      currentAudio.currentTime = 0
    } catch {
      // ignore
    }
    currentAudio = null
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel()
  }
}

function playFile(src) {
  stopAudio()
  const audio = new Audio(src)
  audio.playsInline = true
  currentAudio = audio
  audio.onended = () => {
    if (currentAudio === audio) currentAudio = null
  }
  return audio.play()
}

function playFileToEnd(src) {
  return new Promise((resolve, reject) => {
    stopAudio()
    const audio = new Audio(src)
    audio.playsInline = true
    currentAudio = audio

    let settled = false
    const finish = (ok, err) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      if (currentAudio === audio) currentAudio = null
      if (ok) resolve()
      else reject(err || new Error('audio error'))
    }

    const timer = window.setTimeout(() => {
      try { audio.pause() } catch { /* ignore */ }
      finish(false, new Error('audio timeout'))
    }, 5000)

    audio.onended = () => finish(true)
    audio.onerror = () => finish(false)
    audio.play().catch(err => finish(false, err))
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

/** Play a Georgian example word. */
export function speakWord(text) {
  const clean = stripForAudio(text)
  if (!clean) return Promise.resolve()
  if (/\s/.test(clean)) return speakPhrase(clean)
  const src = `/audio/words/${wordAudioKey(clean)}.mp3`
  return playFile(src).catch(() => speakWithTTS(clean))
}

/**
 * Phrases: full MP3 → each known token MP3 (skip missing) → TTS fallback.
 * Previously one missing token (e.g. მე) aborted the whole phrase.
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
    let played = 0
    for (const tok of tokens) {
      try {
        await playFileToEnd(`/audio/words/${wordAudioKey(tok)}.mp3`)
        played += 1
      } catch {
        // Missing file — skip and keep going (don't silence the rest)
      }
    }
    if (played > 0) return
  }

  return speakWithTTS(clean)
}

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
