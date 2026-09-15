import { useState, useEffect } from 'react'
import { emptySkills } from '../utils/pathUnlock'

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
    skills: emptySkills(),
  }
}

function migrate(raw) {
  const base = defaults()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    alphabetSeen: Array.isArray(raw.alphabetSeen) ? raw.alphabetSeen : [],
    learnedWords: Array.isArray(raw.learnedWords) ? raw.learnedWords : [],
    alphabetBestQuiz: Number(raw.alphabetBestQuiz) || 0,
    skills: {
      ...base.skills,
      ...(raw.skills || {}),
    },
  }
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

export function useProgress() {
  const [progress, setProgress] = useState(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(progress))
  }, [progress])

  function recordAnswer(wordId, correct, skill) {
    setProgress(p => {
      const today = new Date().toDateString()
      const streak =
        p.lastDate === today ? p.streak
        : p.lastDate === yesterday() ? p.streak + 1
        : 1

      const next = {
        ...p,
        streak,
        lastDate: today,
        totalCorrect: p.totalCorrect + (correct ? 1 : 0),
        totalAttempts: p.totalAttempts + 1,
        learnedWords:
          correct && !p.learnedWords.includes(wordId)
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

  function recordAlphabetSeen(letter) {
    setProgress(p => ({
      ...p,
      alphabetSeen: p.alphabetSeen.includes(letter)
        ? p.alphabetSeen
        : [...p.alphabetSeen, letter],
    }))
  }

  function recordAlphabetQuiz(correct) {
    setProgress(p => ({
      ...p,
      alphabetBestQuiz: Math.max(p.alphabetBestQuiz || 0, correct),
    }))
  }

  function resetProgress() {
    setProgress(defaults())
  }

  return {
    progress,
    recordAnswer,
    recordSkillRound,
    recordAlphabetSeen,
    recordAlphabetQuiz,
    resetProgress,
  }
}
