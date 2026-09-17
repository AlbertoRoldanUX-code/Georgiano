import { useState } from 'react'
import { colorSwatch, wordEmoji, wordImageUrl, isColorWord } from '../utils/wordImage'

/**
 * Shows a photo (or color swatch / emoji fallback) for a vocab item.
 */
export default function WordImage({ word, size = 'lg' }) {
  const [phase, setPhase] = useState('photo') // photo | emoji
  if (!word) return null

  const swatch = isColorWord(word) ? colorSwatch(word) : null
  if (swatch) {
    return (
      <div
        className={`word-image word-image-${size} word-image-swatch`}
        style={{ background: swatch, border: swatch === '#f5f5f5' ? '1px solid var(--border)' : 'none' }}
        role="img"
        aria-label={word.english}
      />
    )
  }

  if (String(word.id || '').startsWith('num')) {
    const digit = (word.alts && word.alts[0]) || word.english
    return (
      <div className={`word-image word-image-${size} word-image-number`} aria-label={word.english}>
        {digit}
      </div>
    )
  }

  const urls = wordImageUrl(word)
  const src = word.image || urls.remote

  if (phase === 'emoji' || !src) {
    return (
      <div className={`word-image word-image-${size} word-image-emoji`} aria-label={word.english}>
        {wordEmoji(word)}
      </div>
    )
  }

  return (
    <div className={`word-image word-image-${size}`}>
      <img
        key={word.id}
        src={src}
        alt={word.english}
        loading="lazy"
        onError={() => setPhase('emoji')}
      />
    </div>
  )
}
