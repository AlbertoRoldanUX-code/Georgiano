/** Shared HTMLAudioElement — required for reliable iOS playback. */
let wordPlayer = null
let audioCtx = null

function getWordPlayer() {
  if (!wordPlayer) {
    wordPlayer = new Audio()
    wordPlayer.setAttribute('playsinline', 'true')
    wordPlayer.preload = 'auto'
  }
  return wordPlayer
}

function getAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!audioCtx) audioCtx = new AC()
  return audioCtx
}

/** Call synchronously inside a tap/pointerdown handler. */
export function unlockAudio() {
  const ctx = getAudioContext()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

/**
 * Play a Georgian word immediately.
 * Call this directly from onClick (no setTimeout wrappers).
 */
export function speakWord(text) {
  unlockAudio()
  const player = getWordPlayer()
  const url = `/audio/words/${wordAudioKey(text)}.mp3`

  player.pause()
  player.src = url
  player.currentTime = 0

  const p = player.play()
  if (p && typeof p.catch === 'function') {
    p.catch(() => {
      // Retry once after load
      const retry = () => {
        player.play().catch(() => {})
      }
      player.addEventListener('canplaythrough', retry, { once: true })
      player.load()
    })
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

export function playCorrectSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const run = () => {
    try {
      beep(ctx, 740, 0, 0.1, 0.28)
      beep(ctx, 990, 0.1, 0.16, 0.28)
    } catch {
      // ignore
    }
  }
  if (ctx.state === 'suspended') ctx.resume().then(run).catch(() => {})
  else run()
}

export function playWrongSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const run = () => {
    try {
      beep(ctx, 180, 0, 0.24, 0.2, 'square')
    } catch {
      // ignore
    }
  }
  if (ctx.state === 'suspended') ctx.resume().then(run).catch(() => {})
  else run()
}
