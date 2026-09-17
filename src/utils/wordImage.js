/**
 * Instant visuals for vocab: emoji, color swatch, or number digit.
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
  com6: '🥟', com7: '🫓', com8: '🍎', com9: '🥦', com10: '🥩',
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
  ph1: '👋', ph2: '🙏', ph3: '💬', ph4: '😊', ph5: '🇪🇸', ph6: '🇬🇪',
  ph7: '💧', ph8: '☕', ph9: '📍', ph10: '🚻', ph11: '❤️', ph12: '🍷',
  ph13: '🪪', ph14: '✍️', ph15: '😕', ph16: '🇬🇧', ph17: '💰',
  ph18: '🥟', ph19: '👋', ph20: '🙏',
}

function baseMeaning(word) {
  return String(word.english || '').split('/')[0].trim().toLowerCase()
}

export function colorSwatch(word) {
  return COLOR_SWATCH[baseMeaning(word)] || null
}

export function isColorWord(word) {
  return !!colorSwatch(word)
}

export function wordEmoji(word) {
  if (!word) return '📘'
  if (EMOJI[word.id]) return EMOJI[word.id]
  return '📘'
}
