import { useEffect, useReducer, useRef } from 'react'
import { alphabet } from '../data/alphabet'
import { getUnit } from '../data/units'
import { playCorrectSound, playWrongSound, speakPhrase, speakWord, stopAudio } from '../utils/audio'
import { normalize } from '../utils/normalize'
import { mcqOptions } from '../utils/sessionPick'
import WordImage from './WordImage'

const TEACH_SIZE = 4
const GEO_LETTERS = alphabet.map(l => l.letter)
const AUTO_ADVANCE_MS = 850

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function matchesGeorgian(input, word) {
  const n = normalize(input)
  if (!n) return false
  return n === normalize(word.georgian)
}

function isPhraseItem(item) {
  return Array.isArray(item?.tokens)
}

function pickTeachItems(progress, pool, size = TEACH_SIZE) {
  if (!pool.length) return []
  const fresh = pool.filter(item => {
    if (isPhraseItem(item)) {
      const e = progress.phrases?.[item.id]
      if (!e) return true
      return !(e.comprehend?.attempts || e.order?.attempts || e.produce?.attempts)
    }
    const e = progress.words?.[item.id]
    if (!e) return true
    return !(e.meaning?.attempts || e.reading?.attempts || e.listening?.attempts || e.produce?.attempts)
  })
  const review = pool.filter(w => !fresh.includes(w))
  const picked = []
  // Prefer a mix: ~half phrases when available
  const freshPhrases = shuffle(fresh.filter(isPhraseItem))
  const freshWords = shuffle(fresh.filter(w => !isPhraseItem(w)))
  const reviewPhrases = shuffle(review.filter(isPhraseItem))
  const reviewWords = shuffle(review.filter(w => !isPhraseItem(w)))

  const phraseTarget = Math.min(2, Math.max(1, Math.floor(size / 2)), freshPhrases.length + reviewPhrases.length)
  for (const w of [...freshPhrases, ...reviewPhrases]) {
    if (picked.filter(isPhraseItem).length >= phraseTarget) break
    if (picked.length >= size) break
    picked.push(w)
  }
  for (const w of [...freshWords, ...reviewWords, ...freshPhrases, ...reviewPhrases]) {
    if (picked.length >= size) break
    if (!picked.includes(w)) picked.push(w)
  }
  return shuffle(picked)
}

/**
 * Teach first, then practice ONLY those items, in skill blocks:
 * Listen → Read → Talk → Write (+ order for multi-word phrases)
 */
function buildSession(progress, pool) {
  const teachSize = Math.min(TEACH_SIZE, Math.max(4, Math.min(5, pool.length)))
  const teachItems = pickTeachItems(progress, pool, teachSize)
  if (!teachItems.length) return { teachItems: [], questions: [] }

  const questions = []
  for (const w of teachItems) {
    questions.push({ kind: 'listen_meaning', word: w, section: 'Listen' })
  }
  for (const w of teachItems) {
    questions.push({ kind: 'read_meaning', word: w, section: 'Read' })
  }
  for (const w of teachItems) {
    questions.push({ kind: 'speak_pick', word: w, section: 'Talk' })
  }
  for (const w of teachItems) {
    questions.push({ kind: 'write_geo', word: w, section: 'Write' })
  }
  for (const w of teachItems) {
    if (isPhraseItem(w) && w.tokens.length >= 2) {
      questions.push({ kind: 'phrase_order', word: w, section: 'Write' })
    }
  }
  return { teachItems, questions }
}

function optsFor(q, pool) {
  if (!q) return []
  if (q.kind === 'read_meaning' || q.kind === 'listen_meaning' || q.kind === 'speak_pick') {
    return mcqOptions(q.word, pool)
  }
  return []
}

const initial = {
  active: false,
  done: false,
  phase: 'teach',
  status: 'prompt',
  teachWords: [],
  teachIdx: 0,
  questions: [],
  pool: [],
  idx: 0,
  opts: [],
  pickedId: null,
  typed: '',
  lastCorrect: null,
  answers: {},
  score: { c: 0, w: 0 },
  step: 0,
  bank: [],
  built: [],
  reviewing: false,
}

function restoreAnswer(state, idx, reviewing = false) {
  const prevAns = state.answers[idx]
  const q = state.questions[idx]
  return {
    ...state,
    idx,
    opts: optsFor(q, state.pool),
    status: prevAns ? 'feedback' : 'prompt',
    pickedId: prevAns?.pickedId ?? null,
    typed: prevAns?.typed ?? '',
    lastCorrect: prevAns ? !!prevAns.correct : null,
    bank: q?.kind === 'phrase_order' ? shuffle([...(q.word.tokens || [])]) : [],
    built: prevAns?.built || [],
    reviewing: !!reviewing,
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
        bank: q0?.kind === 'phrase_order' ? shuffle([...(q0.word.tokens || [])]) : [],
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
          reviewing: false,
          opts: optsFor(q0, state.pool),
          bank: q0?.kind === 'phrase_order' ? shuffle([...(q0.word.tokens || [])]) : [],
          built: [],
          step: state.step + 1,
        }
      }
      return { ...state, teachIdx: next, step: state.step + 1 }
    }
    case 'prev': {
      if (state.phase === 'teach') {
        if (state.teachIdx <= 0) return state
        return { ...state, teachIdx: state.teachIdx - 1, step: state.step + 1 }
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
          reviewing: false,
          step: state.step + 1,
        }
      }
      return restoreAnswer(state, state.idx - 1, true)
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return state
      if (state.answers[state.idx]) return state
      return {
        ...state,
        status: 'feedback',
        reviewing: false,
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
    case 'backspace':
      if (state.status !== 'prompt') return state
      return { ...state, typed: state.typed.slice(0, -1) }
    case 'append':
      if (state.status !== 'prompt') return state
      return { ...state, typed: state.typed + (action.ch || '') }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return {
          ...state,
          done: true,
          status: 'prompt',
          pickedId: null,
          typed: '',
          lastCorrect: null,
          reviewing: false,
        }
      }
      return restoreAnswer({ ...state, step: state.step }, next, false)
    }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'listen_meaning') return 'Listen — what does it mean?'
  if (kind === 'speak_pick') return 'Talk — how do you say this?'
  if (kind === 'write_geo') return 'Write — type it in Georgian'
  if (kind === 'phrase_order') return 'Write — put the words in order'
  return 'Read — what does this mean?'
}

function skillFor(kind, item) {
  if (kind === 'phrase_order') return 'order'
  if (kind === 'listen_meaning') return 'listening'
  if (kind === 'speak_pick' || kind === 'write_geo') return 'produce'
  return isPhraseItem(item) ? 'comprehend' : 'meaning'
}

function speakItem(item) {
  const text = item.georgian
  if ((item.tokens && item.tokens.length > 1) || /\s/.test(text)) {
    return speakPhrase(text)
  }
  return speakWord(text)
}

function shouldAutoPlay(kind) {
  return kind !== 'speak_pick' && kind !== 'write_geo' && kind !== 'phrase_order'
}

export default function UnitLesson({ navigate, progressAPI, level }) {
  const unit = getUnit(level) || getUnit(1)
  const pool = unit.items
  const title = unit.title
  const [state, dispatch] = useReducer(reducer, initial)
  const advanceTimer = useRef(null)
  const typedRef = useRef('')
  typedRef.current = state.typed
  const {
    progress,
    recordWordResult,
    recordPhraseResult,
    recordSkillRound,
    recordAnswer,
    recordLevelRound,
  } = progressAPI
  const total = state.questions.length || 1
  const showingFeedback = state.status === 'feedback'

  function clearAdvance() {
    if (advanceTimer.current) {
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = null
    }
  }

  function start() {
    clearAdvance()
    const { teachItems, questions } = buildSession(progress, pool)
    dispatch({ type: 'boot', teachWords: teachItems, questions, pool })
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

  // Physical keyboard: type Georgian letters, Backspace to delete, Enter to check
  useEffect(() => {
    if (!state.active || state.done || state.phase !== 'practice') return
    if (state.status !== 'prompt') return
    const q = state.questions[state.idx]
    if (q?.kind !== 'write_geo') return

    function onKeyDown(e) {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        dispatch({ type: 'backspace' })
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const typed = typedRef.current
        if (!typed.trim()) return
        const current = state.questions[state.idx]
        if (!current) return
        finish(matchesGeorgian(typed, current.word), { typed })
        return
      }
      if (e.key.length === 1 && GEO_LETTERS.includes(e.key)) {
        e.preventDefault()
        dispatch({ type: 'append', ch: e.key })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.active, state.done, state.phase, state.idx, state.status, state.questions])

  function recordRoundIfDone(correctCount) {
    const pct = Math.round((correctCount / total) * 100)
    recordSkillRound('unit', pct)
    if (level) recordLevelRound('unit', level, pct)
  }

  function goNextPractice() {
    clearAdvance()
    stopAudio()
    document.activeElement?.blur?.()
    const willFinish = state.idx + 1 >= state.questions.length
    if (willFinish) recordRoundIfDone(state.score.c)
    dispatch({ type: 'next' })
  }

  function goPrev() {
    clearAdvance()
    stopAudio()
    dispatch({ type: 'prev' })
  }

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done || state.phase !== 'practice') return
    if (state.answers[state.idx]) return
    const q = state.questions[state.idx]
    clearAdvance()

    dispatch({ type: 'answer', correct, ...extra })
    const sk = skillFor(q.kind, q.word)
    if (isPhraseItem(q.word)) {
      const phraseSkill = sk === 'listening' || sk === 'meaning' ? 'comprehend' : sk
      recordPhraseResult(q.word.id, phraseSkill, correct)
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
        if (state.idx + 1 >= total) recordRoundIfDone(finalCorrect)
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
    finish(matchesGeorgian(state.typed, q.word), { typed: state.typed })
  }

  function checkOrder() {
    const q = state.questions[state.idx]
    if (state.built.length !== (q.word.tokens?.length || 0)) return
    finish(state.built.join(' ') === q.word.tokens.join(' '))
  }

  function typeLetter(ch) {
    if (showingFeedback) return
    dispatch({ type: 'append', ch })
  }

  const canGoPrev = state.phase === 'teach'
    ? state.teachIdx > 0
    : state.idx > 0 || state.teachWords.length > 0

  // Continue only after a wrong answer (never on a fresh correct — that auto-advances)
  const showContinue = showingFeedback && state.lastCorrect === false
  // If user went back to a past correct item, offer Next (not labeled Continue)
  const showNextReview = showingFeedback && state.reviewing && state.lastCorrect === true

  if (state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '⭐'}</div>
          <h2 className="result-title">{title} complete</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            {unit.grammar} · listen · read · talk · write
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
            style={{ width: `${(state.teachIdx / (teachTotal + total)) * 100}%` }}
          />
        </div>

        <p className="practice-kind">
          Learn · {state.teachIdx + 1}/{teachTotal}
          {isPhraseItem(word) ? ' · phrase' : ' · word'}
        </p>
        {unit.grammar && <p className="phrase-pattern">{unit.grammar}</p>}

        <div className="teach-card" key={`teach-${state.step}`}>
          <WordImage word={word} size="lg" />
          <div className="practice-letter decode-word">{word.georgian}</div>
          <div className="decode-roman-hint">{word.roman}</div>
          <div className="teach-meaning">{word.english}</div>
          {word.note && <div className="phrase-note">{word.note}</div>}
          <button type="button" className="sound-btn" onClick={() => speakItem(word)}>
            ▶ Listen again
          </button>
        </div>

        <div className="exercise-nav">
          <button type="button" className="btn btn-ghost" disabled={!canGoPrev} onClick={goPrev}>
            ← Previous
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              stopAudio()
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
  const typedOk = matchesGeorgian(state.typed, word)

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">{title}</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(state.idx / total) * 100}%` }} />
      </div>

      <div className="quiz-score" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
          {state.idx + 1}/{total}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {state.score.c}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {state.score.w}</span>
      </div>

      <p className="phrase-pattern" style={{ marginBottom: 4 }}>{q.section}</p>
      <p className="practice-kind">{kindLabel(q.kind)}</p>

      <div className="practice-prompt" key={`dq-${state.step}`}>
        {q.kind === 'listen_meaning' && (
          <button type="button" className="sound-btn sound-btn-lg" onClick={() => speakItem(word)}>
            ▶ Listen
          </button>
        )}
        {q.kind === 'read_meaning' && (
          <>
            <div className="practice-letter decode-word">{word.georgian}</div>
            <button type="button" className="sound-btn" onClick={() => speakItem(word)}>▶ Listen</button>
          </>
        )}
        {q.kind === 'speak_pick' && (
          <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.75rem' }}>
            {word.english}
          </div>
        )}
        {q.kind === 'write_geo' && (
          <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.75rem' }}>
            {word.english}
          </div>
        )}
        {q.kind === 'phrase_order' && (
          <div className="practice-letter" style={{ fontFamily: 'inherit', fontSize: '1.5rem' }}>
            {word.english}
          </div>
        )}
      </div>

      {q.kind === 'write_geo' && (
        <>
          <div className={`write-display${showingFeedback ? (typedOk ? ' correct' : ' wrong') : ''}`}>
            {state.typed || <span className="write-placeholder">Type or tap Georgian letters…</span>}
          </div>
          {showingFeedback && (
            <div className="recall-answer">
              Answer: <strong>{word.georgian}</strong> · {word.english}
            </div>
          )}
          {!showingFeedback && (
            <div className="geo-keyboard" aria-label="Georgian keyboard">
              {GEO_LETTERS.map(letter => (
                <button
                  key={letter}
                  type="button"
                  className="geo-key"
                  onClick={() => typeLetter(letter)}
                >
                  {letter}
                </button>
              ))}
              <button
                type="button"
                className="geo-key geo-key-wide"
                onClick={() => dispatch({ type: 'backspace' })}
              >
                ⌫
              </button>
              <button
                type="button"
                className="geo-key geo-key-check"
                disabled={!state.typed.trim()}
                onClick={handleSubmit}
              >
                Check →
              </button>
            </div>
          )}
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

      {(q.kind === 'read_meaning' || q.kind === 'listen_meaning' || q.kind === 'speak_pick') && (
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
                {q.kind === 'speak_pick' ? (
                  <span className="option-geo">{opt.georgian}</span>
                ) : (
                  opt.english
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="exercise-nav">
        <button type="button" className="btn btn-ghost" disabled={!canGoPrev} onClick={goPrev}>
          ← Previous
        </button>
        {showContinue && (
          <button type="button" className="btn btn-primary" onClick={goNextPractice}>
            Continue →
          </button>
        )}
        {showNextReview && (
          <button type="button" className="btn btn-primary" onClick={goNextPractice}>
            Next →
          </button>
        )}
      </div>

      {showingFeedback && state.lastCorrect === false && (
        <div className="feedback-msg wrong" style={{ marginTop: 12 }}>
          <WordImage key={word.id} word={word} size="sm" />
          <div style={{ marginTop: 8 }}>
            Correct: <strong>{word.georgian}</strong> = {word.english}
          </div>
        </div>
      )}
    </div>
  )
}
