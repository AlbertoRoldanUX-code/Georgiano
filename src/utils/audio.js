let audioCtx = null

function getAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

/** Must stay sync with the tap so iOS unlocks audio. */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function beep(ctx, freq, when, duration, volume, type = 'sine') {
  const t0 = ctx.currentTime + when
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  gain.gain.setValueAtTime(Math.max(volume, 0.001), t0)
  gain.gain.exponentialRampToValueAtTime(0.01, t0 + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration)
}

function withAudio(play) {
  const ctx = getAudioContext()
  if (!ctx) return
  const run = () => {
    try {
      play(ctx)
    } catch {
      // ignore
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().then(run).catch(() => {})
  } else {
    run()
  }
}

export function playCorrectSound() {
  withAudio(ctx => {
    beep(ctx, 740, 0, 0.1, 0.28)
    beep(ctx, 990, 0.1, 0.16, 0.28)
  })
}

export function playWrongSound() {
  withAudio(ctx => {
    beep(ctx, 180, 0, 0.24, 0.2, 'square')
  })
}

let currentAudio = null

export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

/** Reproduce una palabra georgiana (MP3 pregenerado). */
export function speakWord(text) {
  unlockAudio()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  const audio = new Audio(`/audio/words/${wordAudioKey(text)}.mp3`)
  currentAudio = audio
  const play = () => {
    audio.play().catch(() => {
      if (!window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = 'ka-GE'
      utter.rate = 0.85
      window.speechSynthesis.speak(utter)
    })
  }
  // Small delay helps after UI swap on mobile
  setTimeout(play, 40)
}
