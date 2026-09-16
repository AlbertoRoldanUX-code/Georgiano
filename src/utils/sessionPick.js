import { isDue, priority, shuffle } from './srs'

/**
 * Pick ~70% review / due items and ~30% newer ones from a pool.
 * @param {object} progress
 * @param {Array} pool - items with `.id`
 * @param {(item, progress) => object|null} getCard - SRS card for weighting
 * @param {number} size
 */
export function pickSpacedItems(progress, pool, getCard, size = 10) {
  if (!pool.length) return []
  const scored = pool.map(item => {
    const card = getCard(item, progress)
    return { item, weight: priority(card), known: !!(card?.attempts) }
  })
  scored.sort((a, b) => b.weight - a.weight)

  const reviewTarget = Math.max(1, Math.round(size * 0.7))
  const review = []
  const fresh = []
  for (const s of scored) {
    if (s.known || isDue(getCard(s.item, progress))) review.push(s.item)
    else fresh.push(s.item)
  }

  const picked = []
  const take = (arr, n) => {
    for (const x of arr) {
      if (picked.length >= size) break
      if (picked.includes(x)) continue
      if (n <= 0) break
      picked.push(x)
      n--
    }
  }

  take(review, reviewTarget)
  take(shuffle(fresh.length ? fresh : scored.map(s => s.item)), size - picked.length)
  // Fill remainder from top scored
  take(scored.map(s => s.item), size - picked.length)
  return shuffle(picked)
}

export function mcqOptions(correct, pool, key = 'id') {
  const wrong = shuffle(pool.filter(w => w[key] !== correct[key])).slice(0, 3)
  return shuffle([correct, ...wrong])
}
