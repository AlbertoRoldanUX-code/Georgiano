import { allWords } from './vocabulary'
import { phrases } from './phrases'
import { wordDifficulty } from './levels'

/**
 * Single progressive path after Alphabet.
 * Every unit mixes listen · read · write · talk;
 * only difficulty / grammar grow.
 */

const WORD_UNITS = [
  { subtitle: 'Short & clear', grammar: 'First everyday words' },
  { subtitle: 'Common vocab', grammar: 'Family, food, colors basics' },
  { subtitle: 'Trickier sounds', grammar: 'Harder consonants (კ პ ტ ღ ხ…)' },
  { subtitle: 'Longer words', grammar: 'Longer stems & compounds' },
  { subtitle: 'Challenge words', grammar: 'Dense reading & listening' },
]

const PHRASE_UNITS = [
  { subtitle: 'Essential phrases', grammar: 'Greetings & politeness' },
  { subtitle: 'Short patterns', grammar: 'ვარ / ხარ — I am / you are' },
  { subtitle: 'Useful patterns', grammar: 'Want, questions, location' },
  { subtitle: 'Longer sentences', grammar: 'Full everyday sentences' },
]

function assignBuckets(items, scoreFn, count) {
  const scored = items
    .map(item => ({ item, score: scoreFn(item) }))
    .sort((a, b) => a.score - b.score || String(a.item.id).localeCompare(String(b.item.id)))
  const size = Math.ceil(scored.length / count)
  const buckets = []
  for (let i = 0; i < count; i++) {
    buckets.push(scored.slice(i * size, (i + 1) * size).map(s => s.item))
  }
  while (buckets.length > 1 && buckets[buckets.length - 1].length === 0) buckets.pop()
  return buckets
}

function phraseDifficulty(ph) {
  const chars = [...ph.georgian.replace(/\s/g, '').replace(/[?!.,]/g, '')]
  const tokens = ph.tokens?.length || 1
  return chars.length * 2 + tokens * 5
}

function buildUnits() {
  const wordBuckets = assignBuckets(allWords, wordDifficulty, WORD_UNITS.length)
  const phraseBuckets = assignBuckets(phrases, phraseDifficulty, PHRASE_UNITS.length)
  const units = []

  WORD_UNITS.forEach((meta, i) => {
    const words = wordBuckets[i] || []
    if (!words.length) return
    const id = units.length + 1
    units.push({
      id,
      key: `unit-${id}`,
      title: `Level ${id}`,
      subtitle: meta.subtitle,
      grammar: meta.grammar,
      icon: String(id),
      kind: 'words',
      skill: 'Listen · Read · Write · Talk',
      words,
      phrases: [],
      items: words,
    })
  })

  PHRASE_UNITS.forEach((meta, i) => {
    const phs = phraseBuckets[i] || []
    if (!phs.length) return
    const id = units.length + 1
    units.push({
      id,
      key: `unit-${id}`,
      title: `Level ${id}`,
      subtitle: meta.subtitle,
      grammar: meta.grammar,
      icon: String(id),
      kind: 'phrases',
      skill: 'Listen · Read · Write · Talk',
      words: [],
      phrases: phs,
      items: phs,
    })
  })

  return units
}

/** Progressive mixed units after Alphabet. */
export const units = buildUnits()

export function getUnit(unitId) {
  return units.find(u => u.id === Number(unitId)) || null
}

export function unitBest(progress, unitId) {
  const map = progress?.unitLevelBest || {}
  const id = Number(unitId)
  return Number(map[id] || map[String(id)] || 0)
}

/** Alphabet must be ready; then Level N needs ≥60% on Level N−1. */
export function isUnitUnlocked(unitId, progress, alphabetReadyFn) {
  const id = Number(unitId)
  if (!id || id < 1) return false
  if (!alphabetReadyFn(progress)) return false
  if (id === 1) return true
  return unitBest(progress, id - 1) >= 60
}

export function unitUnlockHint(unitId, progress, alphabetReadyFn) {
  if (isUnitUnlocked(unitId, progress, alphabetReadyFn)) return null
  const id = Number(unitId)
  if (!alphabetReadyFn(progress)) {
    return 'Complete Alphabet first'
  }
  const prev = id - 1
  const best = unitBest(progress, prev)
  return `Score ≥60% on Level ${prev} first (best ${best}%)`
}
