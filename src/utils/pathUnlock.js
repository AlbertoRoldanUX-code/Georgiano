import { alphabet } from '../data/alphabet'
import { learningPath } from '../data/vocabulary'
import {
  countRecognitionReady,
  countRecallReady,
  recognitionReady,
  letterEntry,
} from './srs'

/** Alphabet → Decode: enough recognition + some active recall. */
const ALPHA_MIN_SEEN = 22
const ALPHA_MIN_QUIZ = 8
const ALPHA_MIN_RECOGNITION = 18
const ALPHA_MIN_RECALL = 8

/** Skill → next: one solid round, or steady practice. */
const SKILL_MIN_BEST_PCT = 70
const SKILL_MIN_CORRECT = 12
const SKILL_MIN_ACCURACY = 0.65

const PREV = {
  alphabet: null,
  decode: 'alphabet',
  listen: 'decode',
  read: 'listen',
  speak: 'read',
  write: 'speak',
}

const TITLES = Object.fromEntries(learningPath.map(p => [p.id, p.title]))

function emptySkill() {
  return { correct: 0, attempts: 0, bestPct: 0 }
}

export function emptySkills() {
  return {
    listen: emptySkill(),
    read: emptySkill(),
    speak: emptySkill(),
    write: emptySkill(),
    decode: emptySkill(),
  }
}

function skillStats(progress, id) {
  return progress.skills?.[id] || emptySkill()
}

/** Legacy path OR new mastery-based readiness. */
function alphabetReady(progress) {
  const seen = progress.alphabetSeen?.length || 0
  const best = progress.alphabetBestQuiz || 0
  const legacy = seen >= ALPHA_MIN_SEEN && best >= ALPHA_MIN_QUIZ

  const recognized = countRecognitionReady(progress)
  const recalled = countRecallReady(progress)
  const mastery = recognized >= ALPHA_MIN_RECOGNITION && recalled >= ALPHA_MIN_RECALL

  return legacy || mastery
}

function skillReady(stats) {
  if ((stats.bestPct || 0) >= SKILL_MIN_BEST_PCT) return true
  const { correct = 0, attempts = 0 } = stats
  return correct >= SKILL_MIN_CORRECT && attempts > 0 && correct / attempts >= SKILL_MIN_ACCURACY
}

function blockReady(id, progress) {
  if (id === 'alphabet') return alphabetReady(progress)
  return skillReady(skillStats(progress, id))
}

/**
 * Grandfather: if Listen was already unlocked under the old path
 * (alphabet ready + no decode skill yet), keep Listen open while Decode is new.
 */
function grandfatherListen(progress) {
  const decode = skillStats(progress, 'decode')
  const neverTriedDecode = !decode.attempts && !decode.bestPct
  return neverTriedDecode && alphabetReady(progress)
}

/** First step is always open; each later step needs the previous block cleared. */
export function isPathUnlocked(id, progress) {
  if (id === 'listen' && grandfatherListen(progress)) return true
  const prev = PREV[id]
  if (!prev) return true
  return blockReady(prev, progress)
}

export function unlockHint(id, progress) {
  if (isPathUnlocked(id, progress)) return null

  const prev = PREV[id]
  const prevTitle = TITLES[prev] || prev

  if (prev === 'alphabet') {
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
      if (recognized < ALPHA_MIN_RECOGNITION) {
        missing.push(`Or master recognition for ${ALPHA_MIN_RECOGNITION} letters (${recognized} now)`)
      }
      if (recalled < ALPHA_MIN_RECALL) {
        missing.push(`And recall ${ALPHA_MIN_RECALL} letters (${recalled} now)`)
      }
    }
    return {
      why: `Complete ${prevTitle} first`,
      missing,
    }
  }

  const s = skillStats(progress, prev)
  const acc = s.attempts > 0 ? Math.round((s.correct / s.attempts) * 100) : 0
  return {
    why: `Complete ${prevTitle} first`,
    missing: [
      `Get ≥${SKILL_MIN_BEST_PCT}% in one ${prevTitle} round (best ${s.bestPct || 0}%)`,
      `Or ${SKILL_MIN_CORRECT}+ correct at ≥${Math.round(SKILL_MIN_ACCURACY * 100)}% accuracy (now ${s.correct}/${s.attempts}, ${acc}%)`,
    ],
  }
}

export function pathProgressLabel(id, progress) {
  if (id === 'alphabet') {
    const recognized = countRecognitionReady(progress)
    const recalled = countRecallReady(progress)
    const seen = progress.alphabetSeen?.length || 0
    return `${recognized} known · ${recalled} recall · ${seen}/${alphabet.length} seen`
  }
  const s = skillStats(progress, id)
  if (!s.attempts && !s.bestPct) return null
  return `Best round ${s.bestPct || 0}% · ${s.correct}/${s.attempts}`
}

export function isLetterRecognized(progress, letter) {
  return recognitionReady(letterEntry(progress, letter).recognition)
}
