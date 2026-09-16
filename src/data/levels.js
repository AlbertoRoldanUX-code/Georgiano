import { allWords } from './vocabulary'
import { phrases } from './phrases'

/** Letters that are typically harder for Spanish/English learners. */
const HARD_CHARS = new Set([
  'კ', 'პ', 'ტ', 'ყ', 'წ', 'ჭ',
  'თ', 'ფ', 'ქ',
  'ღ', 'ხ', 'შ', 'ჟ', 'ძ', 'ჯ', 'ც', 'ჩ',
])

const LEVEL_META = [
  { id: 1, title: 'Level 1', subtitle: 'Short & clear', icon: '1' },
  { id: 2, title: 'Level 2', subtitle: 'Everyday words', icon: '2' },
  { id: 3, title: 'Level 3', subtitle: 'Trickier sounds', icon: '3' },
  { id: 4, title: 'Level 4', subtitle: 'Longer words', icon: '4' },
  { id: 5, title: 'Level 5', subtitle: 'Challenge', icon: '5' },
]

const PHRASE_META = [
  { id: 1, title: 'Level 1', subtitle: 'One-word essentials', icon: '1' },
  { id: 2, title: 'Level 2', subtitle: 'Short phrases', icon: '2' },
  { id: 3, title: 'Level 3', subtitle: 'Useful patterns', icon: '3' },
  { id: 4, title: 'Level 4', subtitle: 'Longer sentences', icon: '4' },
]

/** Score used to bucket vocabulary by listening/reading difficulty. */
export function wordDifficulty(word) {
  const chars = [...word.georgian.replace(/\s/g, '')]
  const len = chars.length
  const hard = chars.filter(c => HARD_CHARS.has(c)).length
  const spaces = (word.georgian.match(/\s/g) || []).length
  const romanLen = (word.roman || '').replace(/'/g, '').length
  return len * 2 + hard * 2.5 + spaces * 4 + Math.max(0, romanLen - len) * 0.5
}

function phraseDifficulty(ph) {
  const chars = [...ph.georgian.replace(/\s/g, '').replace(/[?!.,]/g, '')]
  const tokens = ph.tokens?.length || 1
  return chars.length * 2 + tokens * 5
}

function assignLevels(items, scoreFn, levelCount) {
  const scored = items
    .map(item => ({ item, score: scoreFn(item) }))
    .sort((a, b) => a.score - b.score || String(a.item.id).localeCompare(String(b.item.id)))

  const size = Math.ceil(scored.length / levelCount)
  const levels = []
  for (let i = 0; i < levelCount; i++) {
    levels.push(scored.slice(i * size, (i + 1) * size).map(s => s.item))
  }
  while (levels.length > 1 && levels[levels.length - 1].length === 0) levels.pop()
  return levels
}

function buildWordLevels(meta = LEVEL_META) {
  const buckets = assignLevels(allWords, wordDifficulty, meta.length)
  return meta.map((m, i) => ({
    ...m,
    key: `level${m.id}`,
    words: buckets[i] || [],
    items: buckets[i] || [],
  })).filter(l => l.words.length > 0)
}

function buildPhraseLevels() {
  const buckets = assignLevels(phrases, phraseDifficulty, PHRASE_META.length)
  return PHRASE_META.map((m, i) => ({
    ...m,
    key: `phrase-level${m.id}`,
    words: buckets[i] || [],
    phrases: buckets[i] || [],
    items: buckets[i] || [],
  })).filter(l => l.items.length > 0)
}

/** Shared word difficulty levels (Listen / Words / Write). */
export const wordLevels = buildWordLevels()

/** @deprecated use wordLevels */
export const listenLevels = wordLevels

export const phraseLevels = buildPhraseLevels()

const BEST_KEY = {
  listen: 'listenLevelBest',
  words: 'wordsLevelBest',
  write: 'writeLevelBest',
  phrases: 'phrasesLevelBest',
}

export function levelsForSkill(skill) {
  if (skill === 'phrases') return phraseLevels
  return wordLevels
}

export function getLevel(skill, levelId) {
  return levelsForSkill(skill).find(l => l.id === Number(levelId)) || null
}

export function itemsForLevel(skill, levelId) {
  const level = getLevel(skill, levelId)
  if (!level) {
    return skill === 'phrases' ? phrases : allWords
  }
  return level.items
}

export function wordsForListenLevel(levelId) {
  return itemsForLevel('listen', levelId)
}

export function getListenLevel(levelId) {
  return getLevel('listen', levelId)
}

function bestMap(progress, skill) {
  return progress?.[BEST_KEY[skill]] || {}
}

function levelBest(progress, skill, levelId) {
  const map = bestMap(progress, skill)
  const id = Number(levelId)
  return Number(map[id] || map[String(id)] || 0)
}

/** Need ≥60% on previous level. No skip / grandfather inside a skill. */
export function isSkillLevelUnlocked(skill, levelId, progress) {
  const id = Number(levelId)
  if (!id || id <= 1) return true
  return levelBest(progress, skill, id - 1) >= 60
}

export function skillLevelUnlockHint(skill, levelId, progress) {
  if (isSkillLevelUnlocked(skill, levelId, progress)) return null
  const prev = Number(levelId) - 1
  const best = levelBest(progress, skill, prev)
  return `Score ≥60% on Level ${prev} first (best ${best}%)`
}

/** Module B unlocks only after Level 3 of module A is cleared. */
export function moduleGateReady(skill, progress, minLevel = 3) {
  return levelBest(progress, skill, minLevel) >= 60
}

export function isListenLevelUnlocked(levelId, progress) {
  return isSkillLevelUnlocked('listen', levelId, progress)
}

export function listenLevelUnlockHint(levelId, progress) {
  return skillLevelUnlockHint('listen', levelId, progress)
}

export { BEST_KEY as LEVEL_BEST_KEYS }
