import { allWords } from './vocabulary'

/** Letters that are typically harder for Spanish/English learners to hear. */
const HARD_CHARS = new Set([
  'კ', 'პ', 'ტ', 'ყ', 'წ', 'ჭ', // ejectives
  'თ', 'ფ', 'ქ', // aspirates
  'ღ', 'ხ', 'შ', 'ჟ', 'ძ', 'ჯ', 'ც', 'ჩ',
])

export function wordDifficulty(word) {
  const chars = [...word.georgian.replace(/\s/g, '')]
  const len = chars.length
  const hard = chars.filter(c => HARD_CHARS.has(c)).length
  const spaces = (word.georgian.match(/\s/g) || []).length
  const romanLen = (word.roman || '').replace(/'/g, '').length

  // Weighted score: length dominates, hard sounds + multi-word push up.
  return len * 2 + hard * 2.5 + spaces * 4 + Math.max(0, romanLen - len) * 0.5
}

function assignLevels(words, levelCount = 5) {
  const scored = words
    .map(w => ({ w, score: wordDifficulty(w) }))
    .sort((a, b) => a.score - b.score || a.w.roman.localeCompare(b.w.roman))

  const size = Math.ceil(scored.length / levelCount)
  const levels = []
  for (let i = 0; i < levelCount; i++) {
    const slice = scored.slice(i * size, (i + 1) * size)
    levels.push(slice.map(s => s.w))
  }
  // Merge any empty trailing buckets into the previous one
  while (levels.length > 1 && levels[levels.length - 1].length === 0) {
    levels.pop()
  }
  return levels
}

const META = [
  { id: 1, title: 'Level 1', subtitle: 'Short & clear', icon: '1' },
  { id: 2, title: 'Level 2', subtitle: 'Everyday words', icon: '2' },
  { id: 3, title: 'Level 3', subtitle: 'Trickier sounds', icon: '3' },
  { id: 4, title: 'Level 4', subtitle: 'Longer words', icon: '4' },
  { id: 5, title: 'Level 5', subtitle: 'Challenge', icon: '5' },
]

const buckets = assignLevels(allWords, 5)

/** Listen difficulty levels (easiest → hardest). */
export const listenLevels = META.map((m, i) => ({
  ...m,
  key: `level${m.id}`,
  words: buckets[i] || [],
})).filter(l => l.words.length > 0)

export function getListenLevel(levelId) {
  const n = Number(levelId)
  return listenLevels.find(l => l.id === n) || null
}

export function wordsForListenLevel(levelId) {
  const level = getListenLevel(levelId)
  return level ? level.words : allWords
}

/**
 * Level 1 always open once Listen is unlocked.
 * Later levels need a decent round on the previous level,
 * or legacy listen practice (grandfather).
 */
export function isListenLevelUnlocked(levelId, progress) {
  const id = Number(levelId)
  if (!id || id <= 1) return true

  const best = progress.listenLevelBest || {}
  if ((best[id - 1] || best[String(id - 1)] || 0) >= 60) return true

  // Grandfather: users who already practiced listening can open early levels.
  const attempts = progress.skills?.listen?.attempts || 0
  if (attempts >= 15 && id <= 3) return true
  if (attempts >= 40 && id <= 5) return true

  return false
}

export function listenLevelUnlockHint(levelId, progress) {
  if (isListenLevelUnlocked(levelId, progress)) return null
  const prev = Number(levelId) - 1
  const best = progress.listenLevelBest?.[prev] || progress.listenLevelBest?.[String(prev)] || 0
  return `Score ≥60% on Level ${prev} first (best ${best}%)`
}
