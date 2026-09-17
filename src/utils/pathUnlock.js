import { alphabet } from '../data/alphabet'
import { learningPath } from '../data/vocabulary'
import {
  countRecognitionReady,
  countRecallReady,
  recognitionReady,
  letterEntry,
} from './srs'
import { isUnitUnlocked, unitBest, units, unitUnlockHint } from '../data/units'

/** Alphabet mastery thresholds. */
const ALPHA_MIN_SEEN = 22
const ALPHA_MIN_QUIZ = 8
const ALPHA_MIN_RECOGNITION = 18
const ALPHA_MIN_RECALL = 8

const TITLES = Object.fromEntries(learningPath.map(p => [p.id, p.title]))

function emptySkill() {
  return { correct: 0, attempts: 0, bestPct: 0 }
}

export function emptySkills() {
  return {
    unit: emptySkill(),
    listen: emptySkill(),
    read: emptySkill(),
    speak: emptySkill(),
    write: emptySkill(),
    decode: emptySkill(),
    words: emptySkill(),
    phrases: emptySkill(),
  }
}

export function alphabetReady(progress) {
  const seen = progress.alphabetSeen?.length || 0
  const best = progress.alphabetBestQuiz || 0
  const legacy = seen >= ALPHA_MIN_SEEN && best >= ALPHA_MIN_QUIZ

  const recognized = countRecognitionReady(progress)
  const recalled = countRecallReady(progress)
  const mastery = recognized >= ALPHA_MIN_RECOGNITION && recalled >= ALPHA_MIN_RECALL

  return legacy || mastery
}

/**
 * Path: alphabet → Level 1 → Level 2 → … (one block at a time).
 * Legacy skill ids map onto the unit path for old routes.
 */
export function isPathUnlocked(id, progress) {
  if (!id || id === 'home' || id === 'alphabet') return true

  // Mixed units: Level 1 opens only after Alphabet; later levels gate on previous.
  if (id === 'unit') return alphabetReady(progress)

  // Legacy skill routes → require alphabet (actual level checked in App for unit)
  if (['decode', 'listen', 'words', 'phrases', 'write', 'read', 'speak', 'quiz', 'translation'].includes(id)) {
    return alphabetReady(progress)
  }

  return alphabetReady(progress)
}

export function isLevelUnlocked(levelId, progress) {
  return isUnitUnlocked(levelId, progress, alphabetReady)
}

export function unlockHint(id, progress) {
  if (isPathUnlocked(id, progress)) return null

  if (id === 'unit' || id === 'decode' || id === 'listen' || id === 'words') {
    return alphabetUnlockHint(progress)
  }

  return alphabetUnlockHint(progress)
}

export function alphabetUnlockHint(progress) {
  if (alphabetReady(progress)) return null
  const seen = progress.alphabetSeen?.length || 0
  const best = progress.alphabetBestQuiz || 0
  const recognized = countRecognitionReady(progress)
  const recalled = countRecallReady(progress)
  const missing = []
  if (recognized < ALPHA_MIN_RECOGNITION && seen < ALPHA_MIN_SEEN) {
    missing.push(`Recognize ${ALPHA_MIN_RECOGNITION} letters (you have ${recognized})`)
  }
  if (recalled < ALPHA_MIN_RECALL && best < ALPHA_MIN_QUIZ) {
    missing.push(`Recall ${ALPHA_MIN_RECALL} letters without options (you have ${recalled})`)
  }
  if (!missing.length) {
    if (seen < ALPHA_MIN_SEEN) {
      missing.push(`See ${ALPHA_MIN_SEEN} letters (you have ${seen}/${alphabet.length})`)
    }
    if (best < ALPHA_MIN_QUIZ) {
      missing.push(`Score ≥${ALPHA_MIN_QUIZ}/12 in Alphabet practice (best ${best}/12)`)
    }
  }
  return { why: `Complete ${TITLES.alphabet || 'Alphabet'} first`, missing }
}

export function levelUnlockHint(levelId, progress) {
  return unitUnlockHint(levelId, progress, alphabetReady)
}

export function pathProgressLabel(id, progress) {
  if (id === 'alphabet') {
    const recognized = countRecognitionReady(progress)
    const recalled = countRecallReady(progress)
    const seen = progress.alphabetSeen?.length || 0
    return `${recognized} known · ${recalled} recall · ${seen}/${alphabet.length} seen`
  }
  if (id === 'unit') {
    const cleared = units.filter(u => unitBest(progress, u.id) >= 60).length
    return cleared ? `${cleared}/${units.length} levels cleared` : null
  }
  const s = progress.skills?.[id]
  if (!s?.attempts && !s?.bestPct) return null
  return `Best round ${s.bestPct || 0}% · ${s.correct}/${s.attempts}`
}

export function isLetterRecognized(progress, letter) {
  return recognitionReady(letterEntry(progress, letter).recognition)
}

export { unitBest, isUnitUnlocked }
