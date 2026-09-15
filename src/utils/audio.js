let audioCtx = null
let currentAudio = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function tone(freq, duration, type = 'sine', volume = 0.12) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Audio not available
  }
}

export function playSelectSound() {
  tone(520, 0.06, 'sine', 0.08)
}

export function playCorrectSound() {
  tone(660, 0.08)
  setTimeout(() => tone(880, 0.12), 70)
}

export function playWrongSound() {
  tone(220, 0.18, 'triangle', 0.1)
}

function letterAudioUrl(letter) {
  return `/audio/${letter.codePointAt(0).toString(16)}.mp3`
}

/** Reproduce pronunciación georgiana (MP3 pregenerados). */
export function speakGeorgian(letter) {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }

  const audio = new Audio(letterAudioUrl(letter))
  currentAudio = audio
  audio.play().catch(() => {
    // Último recurso: nombre aproximado con TTS del sistema
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(letter)
    utter.lang = 'ka-GE'
    utter.rate = 0.85
    window.speechSynthesis.speak(utter)
  })
}
