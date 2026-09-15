import { useState, useEffect } from 'react'

const KEY = 'georgiano_v1'

function load() {
  try {
    const s = localStorage.getItem(KEY)
    return s ? JSON.parse(s) : defaults()
  } catch {
    return defaults()
  }
}

function defaults() {
  return {
    streak: 0,
    lastDate: null,
    learnedWords: [],
    alphabetSeen: [],
    totalCorrect: 0,
    totalAttempts: 0,
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

  function recordAnswer(wordId, correct) {
    setProgress(p => {
      const today = new Date().toDateString()
      const streak =
        p.lastDate === today ? p.streak
        : p.lastDate === yesterday() ? p.streak + 1
        : 1

      return {
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

  function resetProgress() {
    setProgress(defaults())
  }

  return { progress, recordAnswer, recordAlphabetSeen, resetProgress }
}
