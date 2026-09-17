import { colorSwatch, wordEmoji, isColorWord } from '../utils/wordImage'

/**
 * Instant visual for a vocab item: color swatch, number, or emoji.
 * (No remote photos — those were too slow.)
 */
export default function WordImage({ word, size = 'lg' }) {
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

  return (
    <div className={`word-image word-image-${size} word-image-emoji`} aria-label={word.english}>
      {wordEmoji(word)}
    </div>
  )
}
