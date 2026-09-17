import { alphabet } from '../data/alphabet'
import { learningPath } from '../data/vocabulary'
import { moduleGateReady } from '../data/levels'
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

/** Skill → next: one solid round, or steady practice (decode only). */
const SKILL_MIN_BEST_PCT = 70
const SKILL_MIN_CORRECT = 12
const SKILL_MIN_ACCURACY = 0.65

/**
 * Path: alphabet → decode → listen → words → phrases → write
 * Later modules unlock after Level 3 (≥60%) of the previous leveled skill.
 */
const PREV = {
  alphabet: null,
  decode: 'alphabet',
  listen: 'decode',
  words: 'listen',
  phrases: 'words',
  write: 'phrases',
  read: 'listen',
  speak: 'words',
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
    words: emptySkill(),
    phrases: emptySkill(),
  }
}

function skillStats(progress, id) {
  return progress.skills?.[id] || emptySkill()
}

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
  // Decode: Level 3 gate, or legacy skill round (pre-levels users)
  if (id === 'decode') {
    return moduleGateReady('decode', progress, 3) || skillReady(skillStats(progress, 'decode'))
  }
  // Leveled modules: clear Level 3 of that skill
  if (id === 'listen' || id === 'words' || id === 'phrases') {
    return moduleGateReady(id, progress, 3)
  }
  return skillReady(skillStats(progress, id))
}

function grandfatherListen(progress) {
  const decode = skillStats(progress, 'decode')
  const neverTriedDecode = !decode.attempts && !decode.bestPct
  return neverTriedDecode && alphabetReady(progress)
}

export function isPathUnlocked(id, progress) {
  if (id === 'listen' && grandfatherListen(progress)) return true
  if (id === 'read') return isPathUnlocked('words', progress)
  if (id === 'speak') return isPathUnlocked('phrases', progress)

  const prev = PREV[id]
  if (!prev) return true
  if (prev === 'alphabet') return alphabetReady(progress)
  if (prev === 'decode') return blockReady('decode', progress) || grandfatherListen(progress)
  // words needs listen L3; phrases needs words L3; write needs phrases L3
  return blockReady(prev, progress)
}

export function unlockHint(id, progress) {
  if (isPathUnlocked(id, progress)) return null

  const prev = PREV[id] || 'listen'
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
    }
    return { why: `Complete ${prevTitle} first`, missing }
  }

  if (prev === 'decode' || prev === 'listen' || prev === 'words' || prev === 'phrases') {
    const bestKey =
      prev === 'decode' ? 'decodeLevelBest'
      : prev === 'listen' ? 'listenLevelBest'
      : prev === 'words' ? 'wordsLevelBest'
      : 'phrasesLevelBest'
    const best = progress[bestKey]?.[3] || progress[bestKey]?.['3'] || 0
    const legacy = prev === 'decode' ? skillStats(progress, 'decode') : null
    const missing = [`Score ≥60% on ${prevTitle} Level 3 (best ${best}%)`]
    if (legacy && (legacy.bestPct || legacy.attempts)) {
      missing.push(`Or legacy: ≥70% in one Decode round (best ${legacy.bestPct || 0}%)`)
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
