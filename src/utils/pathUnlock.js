import { alphabet } from '../data/alphabet'
import { learningPath } from '../data/vocabulary'

/** Alphabet → Listen: see most letters + pass a quiz (~2/3). */
const ALPHA_MIN_SEEN = 22
const ALPHA_MIN_QUIZ = 8 // best round correct answers (of 12)

/** Skill → next: one solid round, or steady practice. */
const SKILL_MIN_BEST_PCT = 70
const SKILL_MIN_CORRECT = 12
const SKILL_MIN_ACCURACY = 0.65

const PREV = {
  alphabet: null,
  listen: 'alphabet',
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
  }
}

function skillStats(progress, id) {
  return progress.skills?.[id] || emptySkill()
}

function alphabetReady(progress) {
  const seen = progress.alphabetSeen?.length || 0
  const best = progress.alphabetBestQuiz || 0
  return seen >= ALPHA_MIN_SEEN && best >= ALPHA_MIN_QUIZ
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

/** First step is always open; each later step needs the previous block cleared. */
export function isPathUnlocked(id, progress) {
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
    const missing = []
    if (seen < ALPHA_MIN_SEEN) {
      missing.push(`See ${ALPHA_MIN_SEEN} letters (you have ${seen}/${alphabet.length})`)
    }
    if (best < ALPHA_MIN_QUIZ) {
      missing.push(`Score ≥${ALPHA_MIN_QUIZ}/12 in Alphabet quiz (best ${best}/12)`)
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
    const seen = progress.alphabetSeen?.length || 0
    const best = progress.alphabetBestQuiz || 0
    return `${seen}/${alphabet.length} letters · quiz best ${best}/12`
  }
  const s = skillStats(progress, id)
  if (!s.attempts && !s.bestPct) return null
  return `Best round ${s.bestPct || 0}% · ${s.correct}/${s.attempts}`
}
