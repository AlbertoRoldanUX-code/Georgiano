/** Normalize user input for romanization / answer checks. */
export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['ʼʹ‘’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** Strip apostrophes for looser roman matches (k'an → kan). */
export function normalizeLoose(s) {
  return normalize(s).replace(/'/g, '')
}
