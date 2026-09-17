import { useEffect, useReducer, useRef } from 'react'
import { alphabet } from '../data/alphabet'
import { getUnit } from '../data/units'
import { playCorrectSound, playWrongSound, speakPhrase, speakWord } from '../utils/audio'
import { normalize, normalizeLoose } from '../utils/normalize'
import { mcqOptions, pickSpacedItems } from '../utils/sessionPick'

const TEACH_SIZE = 4
const PRACTICE_SIZE = 10
const GEO_LETTERS = alphabet.map(l => l.letter)
const AUTO_ADVANCE_MS = 900

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function matchesGeorgian(input, word) {
  const n = normalize(input)
  if (!n) return false
  return n === normalize(word.georgian)
}

/** Every level mixes listen / read / write / talk; harder levels add writing & listen-pick. */
function kindsForUnit(unit) {
  const id = Number(unit?.id) || 1
  if (unit?.kind === 'phrases') {
    if (id <= 6) return ['read_meaning', 'listen_meaning', 'speak_pick', 'phrase_order']
    return ['read_meaning', 'listen_meaning', 'listen_pick', 'speak_pick', 'write_geo', 'phrase_order']
  }
  if /** Practice only words that were just taught, grouped by skill type. */
function buildSession(progress, pool, unit) {
  const unitKind = unit.kind
  const teachSize = Math.min(TEACH_SIZE, Math.max(3, pool.length))
  const teachItems = pickTeachItems(progress, pool, unitKind, teachSize)
  if (!teachItems.length) return { teachItems: [], questions: [] }

  const questions = []

  // 1) Listen — hear → meaning (English)
  for (const w of teachItems) {
    questions.push({ kind: 'listen_meaning', word: w, section: 'Listen' })
  }
  // 2) Read — see Georgian → meaning
  for (const w of teachItems) {
    questions.push({ kind: 'read_meaning', word: w, section: 'Read' })
  }
  // 3) Talk — English → pick Georgian (no glosses on options)
  for (const w of teachItems) {
    questions.push({ kind: 'speak_pick', word: w, section: 'Talk' })
  }
  // 4) Write — English → type Georgian script (only after teach)
  for (const w of teachItems) {
    questions.push({ kind: 'write_geo', word: w, section: 'Write' })
  }
  // Phrases: order tokens instead of / in addition to write when multi-word
  if (unitKind === 'phrases') {
    for (const w of teachItems) {
      if (w.tokens && w.tokens.length >= 2) {
        questions.push({ kind: 'phrase_order', word: w, section: 'Write' })
      }
    }
  }

  return { teachItems, questions }
}

function pickTeachItems(progress, pool, unitKind, size = TEACH_SIZE) {
  if (!pool.length) return []
  const bag = unitKind === 'phrases' ? 'phrases' : 'words'
  const fresh = pool.filter(w => {
    const e = progress[bag]?.[w.id]
    if (!e) return true
    if (unitKind === 'phrases') {
      return !(e.comprehend?.attempts || e.order?.attempts || e.produce?.attempts)
    }
    return !(e.meaning?.attempts || e.reading?.attempts || e.listening?.attempts || e.produce?.attempts)
  })
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

function optsFor(q, pool) {
  if (!q) return []
  if (
    q.kind === 'read_meaning'
    || q.kind === 'listen_meaning'
    || q.kind === 'speak_pick'
  ) {
    return mcqOptions(q.word, pool)
  }
  return []
}

estions[idx]
  return {
    ...state,
    idx,
    opts: optsFor(q, state.pool),
    status: prevAns ? 'feedback' : 'prompt',
    pickedId: prevAns?.pickedId ?? null,
    typed: prevAns?.typed ?? '',
    lastCorrect: prevAns ? !!prevAns.correct : null,
    bank: q?.kind === 'phrase_order' ? shuffle(q.word.tokens || []) : [],
    built: prevAns?.built || [],
    step: state.step + 1,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { teachWords, questions, pool } = action
      const q0 = questions[0]
      return {
        ...initial,
        active: true,
        phase: teachWords.length ? 'teach' : 'practice',
        teachWords,
        questions,
        pool,
        opts: optsFor(q0, pool),
        bank: q0?.kind === 'phrase_order' ? shuffle(q0.word.tokens || []) : [],
        built: [],
        step: 1,
      }
    }
    case 'teach_next': {
      const next = state.teachIdx + 1
      if (next >= state.teachWords.length) {
        const q0 = state.questions[0]
        return {
          ...state,
          phase: 'practice',
          teachIdx: next,
          status: 'prompt',
          opts: optsFor(q0, state.pool),
          bank: q0?.kind === 'phrase_order' ? shuffle(q0.word.tokens || []) : [],
          built: [],
          step: state.step + 1,
        }
      }
      return {
        ...state,
        teachIdx: next,
        step: state.step + 1,
      }
    }
    case 'teach_prev': {
      if (state.teachIdx <= 0) return state
      return {
        ...state,
        teachIdx: state.teachIdx - 1,
        step: state.step + 1,
      }
    }
    case 'prev': {
      if (state.phase === 'teach') {
        if (state.teachIdx <= 0) return state
        return {
          ...state,
          teachIdx: state.teachIdx - 1,
          step: state.step + 1,
        }
      }
      if (state.idx <= 0) {
        if (!state.teachWords.length) return state
        return {
          ...state,
          phase: 'teach',
          teachIdx: state.teachWords.length - 1,
          status: 'prompt',
          pickedId: null,
          typed: '',
          lastCorrect: null,
          step: state.step + 1,
        }
      }
      return restoreAnswer(state, state.idx - 1)
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return state
      if (state.answers[state.idx]) return state
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId ?? null,
        typed: action.typed ?? state.typed,
        lastCorrect: !!action.correct,
        answers: {
          ...state.answers,
          [state.idx]: {
            correct: !!action.correct,
            pickedId: action.pickedId ?? null,
            typed: action.typed ?? state.typed,
            built: state.built,
          },
        },
        score: {
          c: state.score.c + (action.correct ? 1 : 0),
          w: state.score.w + (action.correct ? 0 : 1),
        },
      }
    }
    case 'tap_bank': {
      if (state.status !== 'prompt') return state
      const token = state.bank[action.index]
      if (token == null) return state
      return {
        ...state,
        bank: state.bank.filter((_, i) => i !== action.index),
        built: [...state.built, token],
      }
    }
    case 'tap_built': {
      if (state.status !== 'prompt') return state
      const token = state.built[action.index]
      if (token == null) return state
      return {
        ...state,
        built: state.built.filter((_, i) => i !== action.index),
        bank: [...state.bank, token],
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
      return restoreAnswer({ ...state, step: state.step }, next)
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
  if (kind === 'phrase_order') return 'Put the words in order'
  return 'What does this mean?'
}

function skillFor(kind, unitKind) {
  if (kind === 'phrase_order') return unitKind === 'phrases' ? 'order' : 'decode'
  if (kind === 'listen_meaning' || kind === 'listen_pick') return 'listening'
  if (kind === 'speak_pick' || kind === 'write_geo') return 'produce'
  if (kind === 'romanize') return 'decode'
  return unitKind === 'phrases' ? 'comprehend' : 'meaning'
}

function speakItem(item) {
  const text = item.georgian
  if ((item.tokens && item.tokens.length > 1) || /\s/.test(text)) {
    return speakPhrase(text)
  }
  return speakWord(text)
}

function shouldAutoPlay(kind) {
  return kind !== 'speak_pick'
}

function GeoOptionLabel({ word, showMeaning = true }) {
  return (
    <span>
      <span className="option-geo">{word.georgian}</span>
      {showMeaning && (
        <span className="option-meta">{word.roman} · {word.english}</span>
      )}
    </span>
  )
}

export default function UnitLesson({ navigate, progressAPI, level }) {
  const unit = getUnit(level) || getUnit(1)
  const pool = unit.items
  const title = unit.title
  const [state, dispatch] = useReducer(reducer, initial)
  const inputRef = useRef(null)
  const advanceTimer = useRef(null)
  const {
    progress,
    recordWordResult,
    recordPhraseResult,
    recordSkillRound,
    recordAnswer,
    recordLevelRound,
  } = progressAPI
  const total = state.questions.length || PRACTICE_SIZE
  const showingFeedback = state.status === 'feedback'
  const levelId = unit.id
  const alreadyAnswered = !!state.answers[state.idx]
  const unitKind = unit.kind

  function clearAdvance() {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }

  function start() {
    clearAdvance()
    const teachWords = pickTeachItems(progress, pool, unitKind, Math.min(TEACH_SIZE, pool.length))
    const questions = buildPractice(progress, pool, teachWords, unit)
    dispatch({ type: 'boot', teachWords, questions, pool })
  }

  useEffect(() => {
    start()
    return () => clearAdvance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  useEffect(() => {
    if (!state.active || state.done || state.status !== 'prompt') return
    let item = null
    if (state.phase === 'teach') {
      item = state.teachWords[state.teachIdx]
    } else {
      const q = state.questions[state.idx]
      if (q && shouldAutoPlay(q.kind)) item = q.word
    }
    if (!item) return
    const t = window.setTimeout(() => {
      speakItem(item).catch(() => {})
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

  function recordRoundIfDone(correctCount) {
    const pct = Math.round((correctCount / total) * 100)
    recordSkillRound('unit', pct)
    if (level) recordLevelRound('unit', level, pct)
  }

  function goNextPractice() {
    clearAdvance()
    document.activeElement?.blur?.()
    const willFinish = state.idx + 1 >= state.questions.length
    if (willFinish) recordRoundIfDone(state.score.c)
    dispatch({ type: 'next' })
  }

  function goPrev() {
    clearAdvance()
    dispatch({ type: 'prev' })
  }

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return
    if (state.answers[state.idx]) return
    const q = state.questions[state.idx]
    clearAdvance()

    dispatch({ type: 'answer', correct, ...extra })
    const sk = skillFor(q.kind, unitKind)
    if (unitKind === 'phrases') {
      recordPhraseResult(q.word.id, sk === 'listening' || sk === 'meaning' ? 'comprehend' : sk, correct)
    } else {
      recordWordResult(q.word.id, sk, correct)
    }
    recordAnswer(q.word.id, correct, 'unit')
    if (correct) playCorrectSound()
    else playWrongSound()

    if (correct) {
      advanceTimer.current = window.setTimeout(() => {
        document.activeElement?.blur?.()
        const finalCorrect = state.score.c + 1
        const willFinish = state.idx + 1 >= total
        if (willFinish) recordRoundIfDone(finalCorrect)
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

  function checkOrder() {
    const q = state.questions[state.idx]
    if (state.built.length !== (q.word.tokens?.length || 0)) return
    const correct = state.built.join(' ') === q.word.tokens.join(' ')
    finish(correct)
  }

  function typeLetter(ch) {
    if (showingFeedback) return
    dispatch({ type: 'type', value: state.typed + ch })
  }

  const canGoPrev = state.phase === 'teach'
    ? state.teachIdx > 0
    : state.idx > 0 || state.teachWords.length > 0

  if (state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '⭐'}</div>
          <h2 className="result-title">{title} complete</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            {unit.grammar} · listen · read · write · talk
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
          <span className="nav-title">{title}</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  if (state.phase === 'teach') {
    const word = state.teachWords[state.teachIdx]
    const teachTotal = state.teachWords.length
    const isLast = state.teachIdx + 1 >= teachTotal
    return (
      <div className="screen">
        <nav className="nav">
          <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
          <span className="nav-title">{title}</span>
        </nav>

        <div className="pbar">
          <div
            className="pbar-fill"
            style={{ width: `${((state.teachIdx) / (teachTotal + total)) * 100}%` }}
          />
        </div>

        <p className="practice-kind">
          New {unitKind === 'phrases' ? 'phrase' : 'word'} · {state.teachIdx + 1}/{teachTotal}
        </p>
        {unit.grammar && <p className="phrase-pattern">{unit.grammar}</p>}

        <div className="teach-card" key={`teach-${state.step}`}>
          <div className="practice-letter decode-word">{word.georgian}</div>
          <div className="decode-roman-hint">{word.roman}</div>
          <div className="teach-meaning">{word.english}</div>
          {word.note && <div className="phrase-note">{word.note}</div>}
          <button
            type="button"
            className="sound-btn"
            onClick={() => speakItem(word)}
          >
            ▶ Listen again
          </button>
        </div>

        <div className="exercise-nav">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!canGoPrev}
            onClick={goPrev}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              speakItem(word).catch(() => {})
              dispatch({ type: 'teach_next' })
            }}
          >
            {isLast ? 'Start practice →' : 'Got it →'}
          </button>
        </div>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const word = q.word
  const typedOk = q.kind === 'write_geo'
    ? matchesGeoOrRoman(state.typed, word)
    : matchesWordRoman(state.typed, word)
  const showContinue = showingFeedback && (state.lastCorrect === false || alreadyAnswered)

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">{title}</span>
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
            onClick={() => speakItem(word)}
          >
            ▶ Listen
          </button>
        )}
        {(q.kind === 'read_meaning' || q.kind === 'phrase_order') && (
          <>
            {q.kind === 'read_meaning' && (
              <div className="practice-letter decode-word">{word.georgian}</div>
            )}
            {q.kind === 'phrase_order' && (
              <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.5rem' }}>
                {word.english}
              </div>
            )}
            {levelId <= 2 && q.kind === 'read_meaning' && (
              <div className="decode-roman-hint">{word.roman}</div>
            )}
            <button type="button" className="sound-btn" onClick={() => speakItem(word)}>
              ▶ Listen
            </button>
          </>
        )}
        {(q.kind === 'romanize' || q.kind === 'write_geo') && (
          <>
            <div className="practice-letter decode-word">
              {q.kind === 'write_geo' ? word.english : word.georgian}
            </div>
            <button type="button" className="sound-btn" onClick={() => speakItem(word)}>
              ▶ Listen
            </button>
          </>
        )}
        {q.kind === 'speak_pick' && (
          <>
            <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.75rem' }}>
              {word.english}
            </div>
            <button type="button" className="sound-btn" onClick={() => speakItem(word)}>
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

      {q.kind === 'phrase_order' && (
        <div className="order-area">
          <div className="order-built">
            {state.built.map((t, i) => (
              <button
                key={`b-${i}-${t}`}
                type="button"
                className="order-chip"
                disabled={showingFeedback}
                onClick={() => dispatch({ type: 'tap_built', index: i })}
              >
                {t}
              </button>
            ))}
            {!state.built.length && (
              <span className="write-placeholder">Tap words below…</span>
            )}
          </div>
          <div className="order-bank">
            {state.bank.map((t, i) => (
              <button
                key={`k-${i}-${t}`}
                type="button"
                className="order-chip bank"
                disabled={showingFeedback}
                onClick={() => dispatch({ type: 'tap_bank', index: i })}
              >
                {t}
              </button>
            ))}
          </div>
          {showingFeedback && (
            <div className="recall-answer">
              <div><strong>{word.georgian}</strong></div>
              {word.note && <div className="phrase-note">{word.note}</div>}
            </div>
          )}
          {!showingFeedback && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 12 }}
              disabled={state.built.length !== (word.tokens?.length || 0)}
              onClick={checkOrder}
            >
              Check
            </button>
          )}
        </div>
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
                {q.kind === 'listen_pick' || q.kind === 'speak_pick' ? (
                  <GeoOptionLabel word={opt} showMeaning={q.kind === 'listen_pick'} />
                ) : (
                  opt.english
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="exercise-nav">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={!canGoPrev}
          onClick={goPrev}
        >
          ← Previous
        </button>
        {showContinue && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNextPractice}
          >
            Continue →
          </button>
        )}
      </div>

      {showingFeedback && state.lastCorrect === false && (
        <div className="feedback-msg wrong" style={{ marginTop: 12 }}>
          Correct: <strong>{word.georgian}</strong> ({word.roman}) = {word.english}
        </div>
      )}
    </div>
  )
}
