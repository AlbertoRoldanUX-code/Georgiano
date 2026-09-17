import { useEffect, useReducer, useRef } from 'react'
import { alphabet } from '../data/alphabet'
import { decodeWords } from '../data/decodeWords'
import { getLevel, itemsForLevel } from '../data/levels'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'
import { normalize, normalizeLoose } from '../utils/normalize'
import { mcqOptions, pickSpacedItems } from '../utils/sessionPick'

const TEACH_SIZE = 4
const PRACTICE_SIZE = 10
const GEO_LETTERS = alphabet.map(l => l.letter)
const AUTO_ADVANCE_MS = 900

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function matchesWordRoman(input, word) {
  const n = normalize(input)
  const loose = normalizeLoose(input)
  if (!n) return false
  const roman = normalize(word.roman)
  const romanLoose = normalizeLoose(word.roman)
  return n === roman || loose === romanLoose
}

function matchesGeoOrRoman(input, word) {
  const n = normalize(input)
  if (!n) return false
  const accepted = [word.georgian, word.roman, ...(word.alts || [])].map(normalize)
  return accepted.includes(n) || normalizeLoose(input) === normalizeLoose(word.roman)
}

/** Exercise mix grows with level difficulty. */
function kindsForLevel(levelId) {
  const id = Number(levelId) || 1
  if (id <= 1) return ['read_meaning', 'listen_meaning', 'speak_pick', 'romanize']
  if (id === 2) return ['read_meaning', 'listen_meaning', 'listen_pick', 'speak_pick', 'romanize']
  if (id === 3) {
    return ['read_meaning', 'listen_meaning', 'listen_pick', 'speak_pick', 'romanize', 'write_geo']
  }
  return ['listen_meaning', 'listen_pick', 'speak_pick', 'romanize', 'write_geo', 'read_meaning']
}

function pickTeachWords(progress, pool, size = TEACH_SIZE) {
  if (!pool.length) return []
  const fresh = pool.filter(w => !(progress.words?.[w.id]?.meaning?.attempts
    || progress.words?.[w.id]?.decode?.attempts
    || progress.words?.[w.id]?.reading?.attempts))
  const review = pool.filter(w => !fresh.includes(w))
  const picked = []
  for (const w of shuffle(fresh)) {
    if (picked.length >= size) break
    picked.push(w)
  }
  for (const w of shuffle(review.length ? review : pool)) {
    if (picked.length >= size) break
    if (!picked.includes(w)) picked.push(w)
  }
  return picked
}

function buildPractice(progress, pool, teachWords, levelId) {
  const kinds = kindsForLevel(levelId)
  const spaced = pickSpacedItems(
    progress,
    pool,
    (w, p) => {
      const e = p.words?.[w.id]
      if (!e) return null
      const cards = [e.decode, e.listening, e.reading, e.meaning, e.produce].filter(Boolean)
      if (!cards.length) return null
      return cards.sort((a, b) => (a.level || 0) - (b.level || 0))[0]
    },
    Math.min(PRACTICE_SIZE, pool.length),
  )

  // Bias session toward the words just taught
  const teachIds = new Set(teachWords.map(w => w.id))
  const ordered = [
    ...spaced.filter(w => teachIds.has(w.id)),
    ...spaced.filter(w => !teachIds.has(w.id)),
  ]
  while (ordered.length < PRACTICE_SIZE && teachWords.length) {
    ordered.push(teachWords[ordered.length % teachWords.length])
  }

  return ordered.slice(0, PRACTICE_SIZE).map((w, i) => ({
    kind: kinds[i % kinds.length],
    word: w,
  }))
}

function optsFor(q, pool) {
  if (!q) return []
  if (
    q.kind === 'read_meaning'
    || q.kind === 'listen_meaning'
    || q.kind === 'listen_pick'
    || q.kind === 'speak_pick'
  ) {
    return mcqOptions(q.word, pool)
  }
  return []
}

const initial = {
  active: false,
  done: false,
  phase: 'teach', // teach | practice
  status: 'prompt', // prompt | feedback
  teachWords: [],
  teachIdx: 0,
  questions: [],
  pool: [],
  idx: 0,
  opts: [],
  pickedId: null,
  typed: '',
  lastCorrect: null,
  score: { c: 0, w: 0 },
  step: 0,
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { teachWords, questions, pool } = action
      return {
        ...initial,
        active: true,
        phase: teachWords.length ? 'teach' : 'practice',
        teachWords,
        questions,
        pool,
        opts: optsFor(questions[0], pool),
        step: 1,
      }
    }
    case 'teach_next': {
      const next = state.teachIdx + 1
      if (next >= state.teachWords.length) {
        return {
          ...state,
          phase: 'practice',
          teachIdx: next,
          status: 'prompt',
          step: state.step + 1,
        }
      }
      return {
        ...state,
        teachIdx: next,
        step: state.step + 1,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return state
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId ?? null,
        typed: action.typed ?? state.typed,
        lastCorrect: !!action.correct,
        score: {
          c: state.score.c + (action.correct ? 1 : 0),
          w: state.score.w + (action.correct ? 0 : 1),
        },
      }
    }
    case 'type':
      if (state.status !== 'prompt') return state
      return { ...state, typed: action.value }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt', pickedId: null, typed: '', lastCorrect: null }
      }
      return {
        ...state,
        idx: next,
        opts: optsFor(state.questions[next], state.pool),
        status: 'prompt',
        pickedId: null,
        typed: '',
        lastCorrect: null,
        step: state.step + 1,
      }
    }
    case 'exit':
      return { ...initial }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'listen_meaning') return 'Listen — what does it mean?'
  if (kind === 'listen_pick') return 'Listen — pick the word'
  if (kind === 'speak_pick') return 'How do you say this?'
  if (kind === 'romanize') return 'Type how it sounds'
  if (kind === 'write_geo') return 'Type it in Georgian'
  return 'What does this mean?'
}

function skillFor(kind) {
  if (kind === 'listen_meaning' || kind === 'listen_pick') return 'listening'
  if (kind === 'speak_pick' || kind === 'write_geo') return 'produce'
  if (kind === 'romanize') return 'decode'
  return 'meaning'
}

function shouldAutoPlay(kind, phase) {
  if (phase === 'teach') return true
  return kind !== 'speak_pick' // speak: english prompt; user can hear model
}

export default function DecodeLesson({ navigate, progressAPI, level }) {
  const levelMeta = getLevel('decode', level)
  const pool = level ? itemsForLevel('decode', level) : decodeWords
  const title = levelMeta ? levelMeta.title : 'All levels'
  const [state, dispatch] = useReducer(reducer, initial)
  const inputRef = useRef(null)
  const advanceTimer = useRef(null)
  const { progress, recordWordResult, recordSkillRound, recordAnswer, recordLevelRound } = progressAPI
  const total = state.questions.length || PRACTICE_SIZE
  const showingFeedback = state.status === 'feedback'
  const levelId = Number(level) || 1

  function clearAdvance() {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }

  function start() {
    clearAdvance()
    const teachWords = pickTeachWords(progress, pool, Math.min(TEACH_SIZE, pool.length))
    const questions = buildPractice(progress, pool, teachWords, levelId)
    dispatch({ type: 'boot', teachWords, questions, pool })
  }

  useEffect(() => {
    start()
    return () => clearAdvance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  // Auto-play audio on teach card / new exercise
  useEffect(() => {
    if (!state.active || state.done || state.status !== 'prompt') return
    let text = null
    if (state.phase === 'teach') {
      text = state.teachWords[state.teachIdx]?.georgian
    } else {
      const q = state.questions[state.idx]
      if (q && shouldAutoPlay(q.kind, 'practice')) text = q.word.georgian
    }
    if (!text) return
    const t = window.setTimeout(() => {
      speakWord(text).catch(() => {})
    }, 180)
    return () => window.clearTimeout(t)
  }, [state.active, state.done, state.phase, state.teachIdx, state.idx, state.status, state.step])

  useEffect(() => {
    if (!state.active || state.done || state.phase !== 'practice') return
    const q = state.questions[state.idx]
    if ((q?.kind === 'romanize' || q?.kind === 'write_geo') && state.status === 'prompt') {
      inputRef.current?.focus()
    }
  }, [state.active, state.done, state.phase, state.idx, state.status, state.questions])

  function goNextPractice() {
    clearAdvance()
    document.activeElement?.blur?.()
    const willFinish = state.idx + 1 >= state.questions.length
    if (willFinish) {
      const finalCorrect = state.score.c
      const pct = Math.round((finalCorrect / total) * 100)
      recordSkillRound('decode', pct)
      if (level) recordLevelRound('decode', level, pct)
    }
    dispatch({ type: 'next' })
  }

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return
    const q = state.questions[state.idx]
    clearAdvance()

    dispatch({ type: 'answer', correct, ...extra })
    recordWordResult(q.word.id, skillFor(q.kind), correct)
    recordAnswer(q.word.id, correct, 'decode')
    if (correct) playCorrectSound()
    else playWrongSound()

    // Correct → brief pause then advance; wrong → wait for Continue
    if (correct) {
      advanceTimer.current = window.setTimeout(() => {
        document.activeElement?.blur?.()
        const finalCorrect = state.score.c + 1
        const willFinish = state.idx + 1 >= total
        if (willFinish) {
          const pct = Math.round((finalCorrect / total) * 100)
          recordSkillRound('decode', pct)
          if (level) recordLevelRound('decode', level, pct)
        }
        dispatch({ type: 'next' })
      }, AUTO_ADVANCE_MS)
    }
  }

  function handlePick(opt) {
    const q = state.questions[state.idx]
    finish(opt.id === q.word.id, { pickedId: opt.id })
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!state.typed.trim()) return
    const q = state.questions[state.idx]
    const ok = q.kind === 'write_geo'
      ? matchesGeoOrRoman(state.typed, q.word)
      : matchesWordRoman(state.typed, q.word)
    finish(ok, { typed: state.typed })
  }

  function typeLetter(ch) {
    if (showingFeedback) return
    dispatch({ type: 'type', value: state.typed + ch })
  }

  if (state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '📖'}</div>
          <h2 className="result-title">Decode complete</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            {title} · listen · read · write · speak
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={start}>Another round</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  if (!state.active || (!state.teachWords.length && !state.questions.length)) {
    return (
      <div className="screen">
        <nav className="nav">
          <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
          <span className="nav-title">Word Decode · {title}</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  // —— Teach phase ——
  if (state.phase === 'teach') {
    const word = state.teachWords[state.teachIdx]
    const teachTotal = state.teachWords.length
    const isLast = state.teachIdx + 1 >= teachTotal
    return (
      <div className="screen">
        <nav className="nav">
          <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
          <span className="nav-title">Word Decode · {title}</span>
        </nav>

        <div className="pbar">
          <div
            className="pbar-fill"
            style={{ width: `${((state.teachIdx) / (teachTotal + total)) * 100}%` }}
          />
        </div>

        <p className="practice-kind">New word · {state.teachIdx + 1}/{teachTotal}</p>

        <div className="teach-card" key={`teach-${state.step}`}>
          <div className="practice-letter decode-word">{word.georgian}</div>
          <div className="decode-roman-hint">{word.roman}</div>
          <div className="teach-meaning">{word.english}</div>
          <button
            type="button"
            className="sound-btn"
            onClick={() => speakWord(word.georgian)}
          >
            ▶ Listen again
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 20 }}
          onClick={() => {
            speakWord(word.georgian).catch(() => {})
            dispatch({ type: 'teach_next' })
          }}
        >
          {isLast ? 'Start practice →' : 'Got it →'}
        </button>
      </div>
    )
  }

  // —— Practice phase ——
  const q = state.questions[state.idx]
  const word = q.word
  const typedOk = q.kind === 'write_geo'
    ? matchesGeoOrRoman(state.typed, word)
    : matchesWordRoman(state.typed, word)

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Word Decode · {title}</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(state.idx / total) * 100}%` }} />
      </div>

      <div className="quiz-score" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
          {state.idx + 1}/{total}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {state.score.c}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {state.score.w}</span>
      </div>

      <p className="practice-kind">{kindLabel(q.kind)}</p>

      <div className="practice-prompt" key={`dq-${state.step}`}>
        {(q.kind === 'listen_meaning' || q.kind === 'listen_pick') && (
          <button
            type="button"
            className="sound-btn sound-btn-lg"
            onClick={() => speakWord(word.georgian)}
          >
            ▶ Listen
          </button>
        )}
        {q.kind === 'read_meaning' && (
          <>
            <div className="practice-letter decode-word">{word.georgian}</div>
            {levelId <= 2 && <div className="decode-roman-hint">{word.roman}</div>}
            <button type="button" className="sound-btn" onClick={() => speakWord(word.georgian)}>
              ▶ Listen
            </button>
          </>
        )}
        {(q.kind === 'romanize' || q.kind === 'write_geo') && (
          <>
            <div className="practice-letter decode-word">
              {q.kind === 'write_geo' ? word.english : word.georgian}
            </div>
            <button type="button" className="sound-btn" onClick={() => speakWord(word.georgian)}>
              ▶ Listen
            </button>
          </>
        )}
        {q.kind === 'speak_pick' && (
          <>
            <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.75rem' }}>
              {word.english}
            </div>
            <button type="button" className="sound-btn" onClick={() => speakWord(word.georgian)}>
              ▶ Hear model
            </button>
          </>
        )}
      </div>

      {q.kind === 'romanize' && (
        <form className="recall-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={`trans-input${showingFeedback ? (typedOk ? ' correct' : ' wrong') : ''}`}
            value={state.typed}
            onChange={e => dispatch({ type: 'type', value: e.target.value })}
            placeholder="Type romanization…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={showingFeedback}
          />
          {showingFeedback && (
            <div className="recall-answer">
              <div>{word.georgian} → <strong>{word.roman}</strong></div>
              <div style={{ color: 'var(--text3)', marginTop: 4 }}>{word.english}</div>
            </div>
          )}
          {!showingFeedback && (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!state.typed.trim()}
              style={{ width: '100%', marginTop: 12 }}
            >
              Check
            </button>
          )}
        </form>
      )}

      {q.kind === 'write_geo' && (
        <>
          <div className={`write-display${showingFeedback ? (typedOk ? ' correct' : ' wrong') : ''}`}>
            {state.typed || <span className="write-placeholder">Tap letters…</span>}
          </div>
          {showingFeedback && (
            <div className="recall-answer">
              Answer: <strong>{word.georgian}</strong> ({word.roman}) · {word.english}
            </div>
          )}
          <div className="geo-keyboard" aria-label="Georgian keyboard">
            {GEO_LETTERS.map(letter => (
              <button
                key={letter}
                type="button"
                className="geo-key"
                disabled={showingFeedback}
                onClick={() => typeLetter(letter)}
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              className="geo-key geo-key-wide"
              disabled={showingFeedback}
              onClick={() => dispatch({ type: 'type', value: state.typed.slice(0, -1) })}
            >
              ⌫
            </button>
            <button
              type="button"
              className="geo-key geo-key-check"
              disabled={showingFeedback || !state.typed.trim()}
              onClick={handleSubmit}
            >
              Check →
            </button>
          </div>
        </>
      )}

      {(q.kind === 'read_meaning' || q.kind === 'listen_meaning' || q.kind === 'listen_pick' || q.kind === 'speak_pick') && (
        <div className="options-stack" key={`dopts-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            if (showingFeedback) {
              if (opt.id === word.id) cls += ' is-correct'
              else if (opt.id === state.pickedId) cls += ' is-wrong'
            }
            return (
              <button
                key={`${state.step}-${opt.id}`}
                type="button"
                className={cls}
                onClick={() => handlePick(opt)}
                disabled={showingFeedback}
              >
                {(q.kind === 'listen_pick' || q.kind === 'speak_pick') ? (
                  <span className="option-geo">{opt.georgian}</span>
                ) : (
                  opt.english
                )}
              </button>
            )
          })}
        </div>
      )}

      {showingFeedback && state.lastCorrect === false && (
        <div className="feedback-continue">
          <div className="feedback-msg wrong">
            Correct: <strong>{word.georgian}</strong> ({word.roman}) = {word.english}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={goNextPractice}
          >
            Continue →
          </button>
        </div>
      )}
    </div>
  )
}
