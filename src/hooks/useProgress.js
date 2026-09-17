import { useState, useEffect } from 'react'
import { emptySkills } from '../utils/pathUnlock'
import {
  applyResult,
  emptyLetterEntry,
  emptyWordEntry,
  emptyPhraseEntry,
} from '../utils/srs'

const KEY = 'georgiano_v1'

function defaults() {
  return {
    streak: 0,
    lastDate: null,
    learnedWords: [],
    alphabetSeen: [],
    totalCorrect: 0,
    totalAttempts: 0,
    alphabetBestQuiz: 0,
    letters: {},
    words: {},
    phrases: {},
    decodeLevelBest: {},
    listenLevelBest: {},
    wordsLevelBest: {},
    phrasesLevelBest: {},
    writeLevelBest: {},
    unitLevelBest: {},
    skills: emptySkills(),
  }
}

function asBestMap(raw) {
  return raw && typeof raw === 'object' ? raw : {}
}

function migrate(raw) {
  const base = defaults()
  if (!raw || typeof raw !== 'object') return base

  const letters = { ...(raw.letters || {}) }
  // Seed recognition exposure from legacy alphabetSeen (does not mark mastery).
  if (Array.isArray(raw.alphabetSeen)) {
    for (const ch of raw.alphabetSeen) {
      if (!letters[ch]) letters[ch] = emptyLetterEntry()
    }
  }

  return {
    ...base,
    ...raw,
    alphabetSeen: Array.isArray(raw.alphabetSeen) ? raw.alphabetSeen : [],
    learnedWords: Array.isArray(raw.learnedWords) ? raw.learnedWords : [],
    alphabetBestQuiz: Number(raw.alphabetBestQuiz) || 0,
    letters,
    words: raw.words && typeof raw.words === 'object' ? raw.words : {},
    phrases: raw.phrases && typeof raw.phrases === 'object' ? raw.phrases : {},
    decodeLevelBest: asBestMap(raw.decodeLevelBest),
    listenLevelBest: asBestMap(raw.listenLevelBest),
    wordsLevelBest: asBestMap(raw.wordsLevelBest),
    phrasesLevelBest: asBestMap(raw.phrasesLevelBest),
    writeLevelBest: asBestMap(raw.writeLevelBest),
    unitLevelBest: migrateUnitBest(raw),
    skills: {
      ...base.skills,
      ...(raw.skills || {}),
    },
  }
}

/** Prefer unitLevelBest; otherwise lift best scores from old skill-separated maps. */
function migrateUnitBest(raw) {
  const existing = asBestMap(raw.unitLevelBest)
  if (Object.keys(existing).length) return existing
  const out = {}
  const sources = [
    asBestMap(raw.decodeLevelBest),
    asBestMap(raw.listenLevelBest),
    asBestMap(raw.wordsLevelBest),
    asBestMap(raw.writeLevelBest),
  ]
  for (const map of sources) {
    for (const [k, v] of Object.entries(map)) {
      const n = Number(v) || 0
      out[k] = Math.max(out[k] || 0, n)
    }
  }
  // Phrase levels shift after 5 word units
  const phrases = asBestMap(raw.phrasesLevelBest)
  for (const [k, v] of Object.entries(phrases)) {
    const id = String(Number(k) + 5)
    const n = Number(v) || 0
    out[id] = Math.max(out[id] || 0, n)
  }
  return out
}

function load() {
  try {
    const s = localStorage.getItem(KEY)
    return migrate(s ? JSON.parse(s) : null)
  } catch {
    return defaults()
  }
}

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toDateString()
}

function bumpStreak(p) {
  const today = new Date().toDateString()
  const streak =
    p.lastDate === today ? p.streak
    : p.lastDate === yesterday() ? p.streak + 1
    : 1
  return { streak, lastDate: today }
}

export function useProgress() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(progress))
  }, [progress])

  function recordAnswer(wordId, correct, skill) {
    setProgress(p => {
      const { streak, lastDate } = bumpStreak(p)
      const next = {
        ...p,
        streak,
        lastDate,
        totalCorrect: p.totalCorrect + (correct ? 1 : 0),
        totalAttempts: p.totalAttempts + 1,
        learnedWords:
          correct && wordId && !p.learnedWords.includes(wordId)
            ? [...p.learnedWords, wordId]
            : p.learnedWords,
      }

      if (skill && next.skills[skill]) {
        const cur = next.skills[skill]
        next.skills = {
          ...next.skills,
          [skill]: {
            ...cur,
            correct: cur.correct + (correct ? 1 : 0),
            attempts: cur.attempts + 1,
          },
        }
      }

      return next
    })
  }

  function recordSkillRound(skill, pct) {
    if (!skill) return
    setProgress(p => {
      const cur = p.skills?.[skill] || { correct: 0, attempts: 0, bestPct: 0 }
      if ((cur.bestPct || 0) >= pct) return p
      return {
        ...p,
        skills: {
          ...p.skills,
          [skill]: { ...cur, bestPct: pct },
        },
      }
    })
  }

  function recordListenLevelRound(levelId, pct) {
    recordLevelRound('listen', levelId, pct)
  }

  function recordLevelRound(skill, levelId, pct) {
    if (!skill || !levelId) return
    const field =
      skill === 'unit' ? 'unitLevelBest'
      : skill === 'decode' ? 'decodeLevelBest'
      : skill === 'listen' ? 'listenLevelBest'
      : skill === 'words' ? 'wordsLevelBest'
      : skill === 'phrases' ? 'phrasesLevelBest'
      : skill === 'write' ? 'writeLevelBest'
      : null
    if (!field) return
    setProgress(p => {
      const key = String(levelId)
      const prev = p[field]?.[key] || 0
      if (prev >= pct) return p
      return {
        ...p,
        [field]: {
          ...(p[field] || {}),
          [key]: pct,
        },
      }
    })
  }

  function recordAlphabetSeen(letter) {
    setProgress(p => {
      const entry = p.letters?.[letter] || emptyLetterEntry()
      return {
        ...p,
        alphabetSeen: p.alphabetSeen.includes(letter)
          ? p.alphabetSeen
          : [...p.alphabetSeen, letter],
        letters: {
          ...p.letters,
          [letter]: entry,
        },
      }
    })
  }

  function recordAlphabetQuiz(correct) {
    setProgress(p => ({
      ...p,
      alphabetBestQuiz: Math.max(p.alphabetBestQuiz || 0, correct),
    }))
  }

  /**
   * Record a letter drill result.
   * @param {'recognition'|'recall'} skill
   * @param {string|null} confusedWith — Georgian letter the user picked wrongly
   */
  function recordLetterResult(letter, skill, correct, confusedWith = null) {
    setProgress(p => {
      const { streak, lastDate } = bumpStreak(p)
      const prev = p.letters?.[letter] || emptyLetterEntry()
      const card = applyResult(prev[skill] || emptyLetterEntry()[skill], correct)
      const confusions = { ...(prev.confusions || {}) }
      if (!correct && confusedWith) {
        confusions[confusedWith] = (confusions[confusedWith] || 0) + 1
      }

      const nextLetters = {
        ...p.letters,
        [letter]: {
          ...prev,
          [skill]: card,
          confusions,
        },
      }

      return {
        ...p,
        streak,
        lastDate,
        totalCorrect: p.totalCorrect + (correct ? 1 : 0),
        totalAttempts: p.totalAttempts + 1,
        alphabetSeen: p.alphabetSeen.includes(letter)
          ? p.alphabetSeen
          : [...p.alphabetSeen, letter],
        letters: nextLetters,
      }
    })
  }

  /** @param {'decode'|'listening'|'reading'|'meaning'|'produce'} skill */
  function recordWordResult(wordId, skill, correct) {
    setProgress(p => {
      const { streak, lastDate } = bumpStreak(p)
      const prev = p.words?.[wordId] || emptyWordEntry()
      const card = applyResult(prev[skill] || emptyWordEntry()[skill], correct)

      return {
        ...p,
        streak,
        lastDate,
        totalCorrect: p.totalCorrect + (correct ? 1 : 0),
        totalAttempts: p.totalAttempts + 1,
        learnedWords:
          correct && !p.learnedWords.includes(wordId)
            ? [...p.learnedWords, wordId]
            : p.learnedWords,
        words: {
          ...p.words,
          [wordId]: {
            ...prev,
            [skill]: card,
          },
        },
      }
    })
  }

  /** @param {'comprehend'|'order'|'produce'} skill */
  function recordPhraseResult(phraseId, skill, correct) {
    setProgress(p => {
      const { streak, lastDate } = bumpStreak(p)
      const prev = p.phrases?.[phraseId] || emptyPhraseEntry()
      const card = applyResult(prev[skill] || emptyPhraseEntry()[skill], correct)

      return {
        ...p,
        streak,
        lastDate,
        totalCorrect: p.totalCorrect + (correct ? 1 : 0),
        totalAttempts: p.totalAttempts + 1,
        phrases: {
          ...p.phrases,
          [phraseId]: {
            ...prev,
            [skill]: card,
          },
        },
      }
    })
  }

  function resetProgress() {
    setProgress(defaults())
  }

  return {
    progress,
    recordAnswer,
    recordSkillRound,
    recordListenLevelRound,
    recordLevelRound,
    recordAlphabetSeen,
    recordAlphabetQuiz,
    recordLetterResult,
    recordWordResult,
    recordPhraseResult,
    resetProgress,
  }
}
