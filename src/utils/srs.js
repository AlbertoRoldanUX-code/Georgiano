import { alphabet } from '../data/alphabet'
import { confusableLetters, ROMAN_VARIANTS } from '../data/confusables'
import { normalize, normalizeLoose } from './normalize'

/** Intervals in minutes (Leitner-style). Level 0 = due now. */
const INTERVALS_MIN = [0, 20, 90, 360, 1440, 4320]

export function emptySkillCard() {
  return {
    correct: 0,
    attempts: 0,
    streak: 0,
    level: 0,
    due: 0,
    ease: 2.3,
  }
}

export function emptyLetterEntry() {
  return {
    recognition: emptySkillCard(),
    recall: emptySkillCard(),
    confusions: {},
  }
}

export function emptyWordEntry() {
  return {
    decode: emptySkillCard(),
    listening: emptySkillCard(),
    reading: emptySkillCard(),
    meaning: emptySkillCard(),
    produce: emptySkillCard(),
  }
}

export function emptyPhraseEntry() {
  return {
    comprehend: emptySkillCard(),
    order: emptySkillCard(),
    produce: emptySkillCard(),
  }
}

function clampLevel(n) {
  return Math.max(0, Math.min(INTERVALS_MIN.length - 1, n))
}

export function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export function isDue(card, now = Date.now()) {
  if (!card || !card.attempts) return true
  return (card.due || 0) <= now
}

export function applyResult(card, correct, now = Date.now()) {
  const next = { ...(card || emptySkillCard()) }
  next.attempts = (next.attempts || 0) + 1
  if (correct) {
    next.correct = (next.correct || 0) + 1
    next.streak = (next.streak || 0) + 1
    next.level = clampLevel((next.level || 0) + 1)
    next.ease = Math.min(2.8, (next.ease || 2.3) + 0.05)
  } else {
    next.streak = 0
    next.level = clampLevel(Math.max(0, (next.level || 0) - 1))
    next.ease = Math.max(1.6, (next.ease || 2.3) - 0.15)
  }
  const mins = INTERVALS_MIN[next.level] || 0
  next.due = now + mins * 60 * 1000
  return next
}

/** Solid recognition → can introduce recall for that letter. */
export function recognitionReady(card) {
  if (!card) return false
  const attempts = Math.max(1, card.attempts || 0)
  return (card.streak || 0) >= 2
    || ((card.correct || 0) >= 3 && card.correct / attempts >= 0.7)
}

export function recallReady(card) {
  if (!card) return false
  const attempts = Math.max(1, card.attempts || 0)
  return (card.streak || 0) >= 2
    || ((card.correct || 0) >= 3 && card.correct / attempts >= 0.65)
}

export function letterEntry(progress, letter) {
  return progress.letters?.[letter] || emptyLetterEntry()
}

export function countRecognitionReady(progress) {
  return alphabet.filter(l =>
    recognitionReady(letterEntry(progress, l.letter).recognition)
  ).length
}

export function countRecallReady(progress) {
  return alphabet.filter(l =>
    recallReady(letterEntry(progress, l.letter).recall)
  ).length
}

export function acceptedRomans(letterObj) {
  const extras = ROMAN_VARIANTS[letterObj.letter] || []
  return [...new Set([letterObj.roman, ...extras])]
}

export function matchesRoman(input, letterObj) {
  const n = normalize(input)
  const loose = normalizeLoose(input)
  if (!n) return false
  return acceptedRomans(letterObj).some(r => {
    const nr = normalize(r)
    const lr = normalizeLoose(r)
    return n === nr || loose === lr
  })
}

/** Priority: due soon / weak / confused → higher weight. */
export function priority(card, confusionBoost = 0) {
  const now = Date.now()
  let score = 0
  if (!card?.attempts) score += 40
  else if (isDue(card, now)) score += 30
  const acc = card?.attempts ? card.correct / card.attempts : 0
  if (acc < 0.6) score += 20
  if ((card?.streak || 0) === 0 && (card?.attempts || 0) > 0) score += 15
  score += Math.max(0, 5 - (card?.level || 0)) * 3
  score += confusionBoost
  score += Math.random() * 5
  return score
}

/**
 * Build a mixed alphabet practice session.
 * ~70% recognition MCQ early; more recall as letters unlock.
 */
export function pickAlphabetSession(progress, size = 12) {
  const items = []

  for (const l of alphabet) {
    const entry = letterEntry(progress, l.letter)
    const confBoost = Object.values(entry.confusions || {}).reduce((a, b) => a + b, 0)

    items.push({
      kind: 'recognize',
      letter: l,
      weight: priority(entry.recognition, confBoost * 4),
    })

    if (recognitionReady(entry.recognition)) {
      items.push({
        kind: 'recall',
        letter: l,
        weight: priority(entry.recall, confBoost * 3) + 8,
      })
    }

    // Occasional reverse: roman → pick Georgian letter (after some recognition)
    if ((entry.recognition.attempts || 0) >= 2) {
      items.push({
        kind: 'reverse',
        letter: l,
        weight: priority(entry.recognition, confBoost * 2) * 0.7,
      })
    }
  }

  items.sort((a, b) => b.weight - a.weight)

  const picked = []
  const seen = new Set()
  for (const item of items) {
    const key = `${item.kind}:${item.letter.letter}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(item)
    if (picked.length >= size) break
  }

  // Cap reverse to ~25% of session
  const reverses = picked.filter(p => p.kind === 'reverse')
  if (reverses.length > Math.ceil(size * 0.25)) {
    const drop = new Set(reverses.slice(Math.ceil(size * 0.25)).map(p => `${p.kind}:${p.letter.letter}`))
    const filtered = picked.filter(p => !drop.has(`${p.kind}:${p.letter.letter}`))
    while (filtered.length < size) {
      const filler = items.find(i =>
        i.kind !== 'reverse'
        && !filtered.some(f => f.kind === i.kind && f.letter.letter === i.letter.letter)
      )
      if (!filler) break
      filtered.push(filler)
    }
    return shuffle(filtered.slice(0, size))
  }

  return shuffle(picked)
}

/** MCQ options: prefer confusable letters as distractors. */
export function recognitionOptions(correct, all = alphabet) {
  const conf = confusableLetters(correct.letter)
    .map(ch => all.find(l => l.letter === ch))
    .filter(Boolean)

  const rest = shuffle(all.filter(l => l.letter !== correct.letter && !conf.includes(l)))
  const wrong = [...shuffle(conf), ...rest].slice(0, 3)
  return shuffle([correct, ...wrong])
}

export function reverseOptions(correct, all = alphabet) {
  return recognitionOptions(correct, all)
}
