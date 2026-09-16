/**
 * Georgian letters that learners often mix up (aspiration, ejectives, similar shapes).
 * Used for smarter MCQ distractors and targeted review.
 */
export const CONFUSION_GROUPS = [
  ['თ', 'ტ'],
  ['კ', 'ქ', 'ყ'],
  ['პ', 'ფ'],
  ['ჩ', 'ჭ'],
  ['ც', 'წ'],
  ['ძ', 'ჯ'],
  ['ღ', 'ხ'],
  ['შ', 'ჟ'],
  ['ზ', 'ს'],
  ['დ', 'ტ', 'თ'],
  ['ბ', 'პ', 'ფ'],
  ['გ', 'კ', 'ქ'],
]

/** Extra accepted romanizations beyond alphabet.js `roman`. */
export const ROMAN_VARIANTS = {
  თ: ['t', 'th'],
  ტ: ["t'", 't'],
  კ: ["k'", 'k'],
  ქ: ['k', 'kh'],
  ყ: ["q'", 'q'],
  პ: ["p'", 'p'],
  ფ: ['p', 'ph', 'f'],
  ჩ: ['ch', "ch'"],
  ჭ: ["ch'", 'ch'],
  ც: ['ts', "ts'"],
  წ: ["ts'", 'ts'],
  ძ: ['dz'],
  ჯ: ['j', 'dzh'],
  ღ: ['gh', 'g'],
  ხ: ['kh', 'x'],
  შ: ['sh'],
  ჟ: ['zh', 'j'],
}

export function confusableLetters(letter) {
  const set = new Set()
  for (const group of CONFUSION_GROUPS) {
    if (group.includes(letter)) {
      for (const l of group) {
        if (l !== letter) set.add(l)
      }
    }
  }
  return [...set]
}
