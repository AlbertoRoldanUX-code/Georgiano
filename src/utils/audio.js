export function wordAudioKey(text) {
  return [...text].map(c => c.codePointAt(0).toString(16)).join('-')
}

function playFile(src) {
  const audio = new Audio(src)
  audio.playsInline = true
  // Must be called directly from a user tap on iOS.
  return audio.play()
}

/** Play a Georgian example word. Call only from a click/tap handler. */
export function speakWord(text) {
  const src = `/audio/words/${wordAudioKey(text)}.mp3`
  playFile(src).catch(() => {})
}

/** Single Mkhedruli letter sound (files live in /audio/, not /audio/words/). */
export function speakLetter(letter) {
  const src = `/audio/${wordAudioKey(letter)}.mp3`
  playFile(src).catch(() => {})
}

export function playCorrectSound() {
  playFile('/audio/correct.wav').catch(() => {})
}

export function playWrongSound() {
  playFile('/audio/wrong.wav').catch(() => {})
}
