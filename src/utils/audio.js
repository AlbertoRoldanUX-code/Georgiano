let audioCtx = null

function getAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

/** Call from a user gesture so iOS/Safari allows sound. */
export async function unlockAudio() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // ignore
    }
  }
}

async function tone(freq, duration, type = 'sine', volume = 0.22) {
  try {
    await unlockAudio()
    const ctx = getAudioContext()
    if (!ctx) return

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

export async function playSelectSound() {
  await tone(520, 0.07, 'sine', 0.14)
}

export async function playCorrectSound() {
  await unlockAudio()
  await tone(740, 0.09, 'sine', 0.24)
  await new Promise(r => setTimeout(r, 90))
  await tone(980, 0.14, 'sine', 0.24)
}

export async function playWrongSound() {
  await unlockAudio()
  await tone(180, 0.22, 'square', 0.16)
}

let currentAudio = null

/** Clave de archivo para una palabra georgiana. */
export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

function playUrl(url, fallbackText) {
  unlockAudio()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  const audio = new Audio(url)
  currentAudio = audio
  audio.play().catch(() => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(fallbackText)
    utter.lang = 'ka-GE'
    utter.rate = 0.85
    window.speechSynthesis.speak(utter)
  })
}

/** Reproduce una palabra georgiana (MP3 pregenerado). */
export function speakWord(text) {
  playUrl(`/audio/words/${wordAudioKey(text)}.mp3`, text)
}
