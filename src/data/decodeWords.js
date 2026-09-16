import { alphabet } from './alphabet'
import { allWords } from './vocabulary'

const ROMAN_BY_LETTER = Object.fromEntries(alphabet.map(l => [l.letter, l.roman]))

function romanize(georgian) {
  let out = ''
  for (const ch of georgian.replace(/\s/g, '')) {
    if (!ROMAN_BY_LETTER[ch]) return null
    out += ROMAN_BY_LETTER[ch]
  }
  return out
}

function uniqueById(words) {
  const seen = new Set()
  return words.filter(w => {
    if (seen.has(w.id)) return false
    seen.add(w.id)
    return true
  })
}

const SHORT_VOCAB = allWords.filter(w => {
  const len = [...w.georgian.replace(/\s/g, '')].length
  return len >= 2 && len <= 5
})

const FROM_ALPHABET = alphabet
  .filter(l => [...l.example].length >= 2 && [...l.example].length <= 4)
  .map((l, i) => ({
    id: `alpha-ex-${i}`,
    georgian: l.example,
    roman: romanize(l.example),
    english: l.exMeaning,
    alts: [],
  }))
  .filter(w => w.roman)

/**
 * Short words for the Word Decode bridge
 * (after alphabet, before heavy listening).
 */
export const decodeWords = uniqueById([...SHORT_VOCAB, ...FROM_ALPHABET])

export function lettersInWord(georgian) {
  return [...georgian.replace(/\s/g, '')]
}

export function wordLettersReady(georgian, isLetterReady) {
  return lettersInWord(georgian).every(ch => isLetterReady(ch))
}
