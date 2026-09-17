/**
 * Visual for each vocab item: photo/illustration URL + emoji fallback.
 * Prefer local `/images/words/{id}.jpg` if you add files later.
 */

const COLOR_SWATCH = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
  black: '#212121',
  white: '#f5f5f5',
  orange: '#fb8c00',
  pink: '#ec407a',
  purple: '#8e24aa',
  violet: '#8e24aa',
  brown: '#6d4c41',
  gray: '#9e9e9e',
  grey: '#9e9e9e',
}

/** Concrete emoji fallbacks when the photo fails to load. */
const EMOJI = {
  sal1: '👋', sal2: '👋', sal3: '🙏', sal4: '✅', sal5: '❌', sal6: '🙇',
  sal7: '👍', sal8: '🙏', sal9: '💬', sal10: '😊', sal11: '🥂', sal12: '🤝',
  num1: '1️⃣', num2: '2️⃣', num3: '3️⃣', num4: '4️⃣', num5: '5️⃣',
  num6: '6️⃣', num7: '7️⃣', num8: '8️⃣', num9: '9️⃣', num10: '🔟',
  num11: '1️⃣1️⃣', num12: '1️⃣2️⃣', num20: '2️⃣0️⃣', num50: '5️⃣0️⃣', num100: '💯',
  fam1: '👩', fam2: '👨', fam3: '👧', fam4: '👦', fam5: '🧒',
  fam6: '👴', fam7: '👵', fam8: '👰', fam9: '🤵', fam10: '🤝',
  fam11: '👨‍👩‍👧', fam12: '👦', fam13: '👧',
  col1: '🟥', col2: '🟦', col3: '🟩', col4: '🟨', col5: '⬛',
  col6: '⬜', col7: '🟧', col8: '🩷', col9: '🟪', col10: '🟫', col11: '⬜',
  com1: '🍞', com2: '💧', com3: '🍷', com4: '☕', com5: '🍵',
  com6: '🥟', com7: '🧀', com8: '🍎', com9: '🥦', com10: '🥩',
  com11: '🧀', com12: '🐟', com13: '🥚', com14: '🥛', com15: '🍬',
  ciu1: '🏙️', ciu2: '🏠', ciu3: '🛣️', ciu4: '🚌', ciu5: '🚇',
  ciu6: '🏨', ciu7: '🍽️', ciu8: '🛍️', ciu9: '🏥', ciu10: '⛪',
  ciu11: '🏪', ciu12: '🌳', ciu13: '🏛️', ciu14: '✈️',
  ver1: '🧍', ver2: '🤲', ver3: '💭', ver4: '🚶', ver5: '➡️',
  ver6: '🍽️', ver7: '🥤', ver8: '👀', ver9: '🧠', ver10: '❤️',
  ver11: '💼', ver12: '📚',
  tim1: '📅', tim2: '🌅', tim3: '⏪', tim4: '⏱️', tim5: '🌄',
  tim6: '🌆', tim7: '🌙', tim8: '📆', tim9: '🗓️', tim10: '🎉',
  tim11: '🕐', tim12: '⏲️',
  trv1: '🇬🇪', trv2: '🏙️', trv3: '🏖️', trv4: '🎫', trv5: '🗺️',
  trv6: '🚕', trv7: '🚆', trv8: '⛰️', trv9: '🌊', trv10: '🧳',
  trv11: '🛂', trv12: '💵',
  // phrases
  ph1: '👋', ph2: '🙏', ph3: '💬', ph4: '😊', ph5: '🇪🇸', ph6: '🇬🇪',
  ph7: '💧', ph8: '☕',
}

/** Search-friendly photo subject for abstract / multi-word meanings. */
const PHOTO_QUERY = {
  hello: 'people waving hello friendly',
  goodbye: 'person waving goodbye',
  'thank you': 'grateful thank you gesture',
  yes: 'green check mark approval',
  no: 'red cross rejection',
  sorry: 'apology sorry expression',
  'good / okay': 'thumbs up okay',
  please: 'polite please gesture hands',
  'how are you?': 'friends talking greeting',
  'well / fine': 'person feeling well smiling',
  cheers: 'clinking wine glasses toast',
  'nice to meet you': 'handshake meeting',
  'I am': 'person pointing to self',
  'I have': 'person holding object',
  'I want': 'person wanting something thoughtful',
  'I go': 'person walking away',
  'comes / is coming': 'person arriving walking toward camera',
  'I eat': 'person eating meal',
  'I drink': 'person drinking glass of water',
  'I see': 'person looking watching',
  'I know': 'person thinking knowing',
  'I love': 'heart love hands',
  'I work': 'person working at desk',
  'I study': 'student studying books',
  today: 'calendar today date',
  tomorrow: 'sunrise tomorrow morning',
  yesterday: 'calendar yesterday',
  now: 'clock now time',
  morning: 'sunny morning sunrise',
  evening: 'sunset evening sky',
  night: 'night sky moon stars',
  'week / Sunday': 'calendar week',
  month: 'calendar month',
  year: 'new year celebration',
  'hour / clock': 'analog wall clock',
  minute: 'stopwatch timer',
  Georgia: 'Georgia Caucasus mountains flag',
  Tbilisi: 'Tbilisi old town Georgia',
  Batumi: 'Batumi seaside Georgia',
  khinkali: 'Georgian khinkali dumplings',
  khachapuri: 'Georgian khachapuri cheese bread',
  Hello: 'people waving hello friendly',
  'Thank you': 'grateful thank you gesture',
  'How are you?': 'friends talking greeting',
  'I am fine': 'person feeling well smiling',
  'I am Spanish': 'Spain flag travel',
  'I am Georgian': 'Georgia flag Caucasus',
  'I want water': 'glass of water',
  'I want coffee': 'cup of coffee',
}

function seedFromId(id) {
  let h = 0
  const s = String(id || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % 100000
}

function baseMeaning(word) {
  const eng = String(word.english || '').trim()
  // colors / numbers: use first token
  return eng.split('/')[0].trim().toLowerCase()
}

export function colorSwatch(word) {
  const key = baseMeaning(word)
  return COLOR_SWATCH[key] || null
}

export function wordEmoji(word) {
  if (!word) return '📷'
  if (EMOJI[word.id]) return EMOJI[word.id]
  return '📷'
}

/**
 * Photo URL for a word/phrase.
 * Uses a generated illustration CDN keyed by meaning (stable seed per id).
 * Override with word.image or drop a file at public/images/words/{id}.jpg
 * and set word.image = `/images/words/${id}.jpg`.
 */
export function wordImageUrl(word) {
  if (!word) return { remote: null }
  if (word.image) return { remote: word.image }

  const meaning = String(word.english || '').trim()
  const query =
    PHOTO_QUERY[meaning]
    || PHOTO_QUERY[baseMeaning(word)]
    || `${meaning}, simple clear photo, educational, centered subject, soft light, no text`

  const prompt = encodeURIComponent(
    `realistic photo of ${query}, clean background, no writing, no letters, no watermark`
  )
  const seed = seedFromId(word.id)
  const remote = `https://image.pollinations.ai/prompt/${prompt}?width=640&height=480&nologo=true&seed=${seed}`

  return { remote }
}

export function isColorWord(word) {
  return !!colorSwatch(word)
}
