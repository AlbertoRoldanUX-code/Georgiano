import { useEffect, useReducer } from 'react'
import { phrases } from '../data/phrases'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'
import { shuffle } from '../utils/srs'
import { mcqOptions, pickSpacedItems } from '../utils/sessionPick'

const SESSION_SIZE = 8

function buildSession(progress) {
  const picked = pickSpacedItems(
    progress,
    phrases,
    (ph, p) => {
      const e = p.phrases?.[ph.id]
      if (!e) return null
      const cards = [e.comprehend, e.order, e.produce].filter(Boolean)
      if (!cards.length) return null
      return cards.sort((a, b) => (a.level || 0) - (b.level || 0))[0]
    },
    SESSION_SIZE,
  )

  return picked.map((ph, i) => {
    const canOrder = ph.tokens.length >= 2
    const roll = i % (canOrder ? 3 : 2)
    if (roll === 0) return { kind: 'meaning', phrase: ph }
    if (roll === 1) return { kind: 'listen_meaning', phrase: ph }
    return { kind: 'order', phrase: ph }
  })
}

function optsFor(q) {
  if (!q || q.kind === 'order') return []
  return mcqOptions(q.phrase, phrases)
}

const initial = {
  active: false,
  done: false,
  status: 'prompt',
  questions: [],
  idx: 0,
  opts: [],
  pickedId: null,
  bank: [],
  built: [],
  history: [],
  step: 0,
  revealedNote: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { questions } = action
      const q0 = questions[0]
      return {
        ...initial,
        active: true,
        questions,
        opts: optsFor(q0),
        bank: q0?.kind === 'order' ? shuffle(q0.phrase.tokens) : [],
        built: [],
        step: 1,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId ?? null,
        history: [...state.history, action.correct ? 'c' : 'w'],
        revealedNote: true,
      }
    }
    case 'tap_bank': {
      if (state.status !== 'prompt') return state
      const token = state.bank[action.index]
      if (token == null) return state
      const bank = state.bank.filter((_, i) => i !== action.index)
      return { ...state, bank, built: [...state.built, token] }
    }
    case 'tap_built': {
      if (state.status !== 'prompt') return state
      const token = state.built[action.index]
      if (token == null) return state
      const built = state.built.filter((_, i) => i !== action.index)
      return { ...state, built, bank: [...state.bank, token] }
    }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt' }
      }
      const q = state.questions[next]
      return {
        ...state,
        idx: next,
        opts: optsFor(q),
        status: 'prompt',
        pickedId: null,
        bank: q.kind === 'order' ? shuffle(q.phrase.tokens) : [],
        built: [],
        step: state.step + 1,
        revealedNote: false,
      }
    }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'listen_meaning') return 'Listen — what does it mean?'
  if (kind === 'order') return 'Put the words in order'
  return 'What does this mean?'
}

function skillFor(kind) {
  if (kind === 'order') return 'order'
  return 'comprehend'
}

export default function PhrasesLesson({ navigate, progressAPI }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const { progress, recordAnswer, recordSkillRound, recordPhraseResult } = progressAPI
  const showingFeedback = state.status === 'feedback'

  function start() {
    dispatch({ type: 'boot', questions: buildSession(progress) })
  }

  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const nextHistory = [...state.history, correct ? 'c' : 'w']
    const willFinish = state.idx + 1 >= state.questions.length

    dispatch({ type: 'answer', correct, ...extra })
    if (correct) playCorrectSound()
    else playWrongSound()

    recordPhraseResult(q.phrase.id, skillFor(q.kind), correct)
    recordAnswer(q.phrase.id, correct, 'phrases')

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) {
        const score = nextHistory.filter(h => h === 'c').length
        recordSkillRound('phrases', Math.round((score / state.questions.length) * 100))
      }
      dispatch({ type: 'next' })
    }, 1400)
  }

  function handlePick(opt) {
    const q = state.questions[state.idx]
    finish(opt.id === q.phrase.id, { pickedId: opt.id })
  }

  function checkOrder() {
    const q = state.questions[state.idx]
    if (state.built.length !== q.phrase.tokens.length) return
    const correct = state.built.join(' ') === q.phrase.tokens.join(' ')
    finish(correct)
  }

  if (state.done) {
    const score = state.history.filter(h => h === 'c').length
    const pct = Math.round((score / state.questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{pct >= 90 ? '🏆' : pct >= 70 ? '💬' : '📝'}</div>
          <h2 className="result-title">Phrases done</h2>
          <div className="result-score">{score}/{state.questions.length}</div>
          <div className="result-sub">Patterns through examples · {pct}%</div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={start}>Again</button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  if (!state.active || !state.questions.length) {
    return (
      <div className="screen">
        <nav className="nav">
          <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
          <span className="nav-title">Phrases</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const ph = q.phrase
  const score = state.history.filter(h => h === 'c').length

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Phrases</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(state.idx / state.questions.length) * 100}%` }} />
      </div>

      <div className="quiz-score">
        {state.history.map((h, i) => (
          <div key={i} className={`score-dot ${h}`} />
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text3)', marginLeft: 6 }}>
          {state.idx + 1}/{state.questions.length}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginLeft: 8 }}>✓ {score}</span>
      </div>

      <p className="practice-kind">{kindLabel(q.kind)}</p>
      <div className="phrase-pattern">{ph.pattern}</div>

      <div className="practice-prompt" key={`pp-${state.step}`}>
        {q.kind === 'listen_meaning' ? (
          <button type="button" className="sound-btn sound-btn-lg" onClick={() => speakWord(ph.georgian)}>
            ▶ Listen
          </button>
        ) : q.kind === 'order' ? (
          <>
            <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '1.5rem' }}>{ph.english}</div>
            <button type="button" className="sound-btn" style={{ marginTop: 10 }} onClick={() => speakWord(ph.georgian)}>
              ▶ Hear model
            </button>
          </>
        ) : (
          <>
            <div className="q-geo">{ph.georgian}</div>
            <button type="button" className="sound-btn" onClick={() => speakWord(ph.georgian)}>▶ Listen</button>
          </>
        )}
      </div>

      {q.kind === 'order' ? (
        <div className="order-area">
          <div className={`order-built${showingFeedback ? (state.built.join(' ') === ph.tokens.join(' ') ? ' correct' : ' wrong') : ''}`}>
            {state.built.length === 0 && !showingFeedback && (
              <span className="write-placeholder">Tap words below…</span>
            )}
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
              <div><strong>{ph.georgian}</strong></div>
              {ph.note && <div className="phrase-note">{ph.note}</div>}
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 12 }}
            disabled={showingFeedback || state.built.length !== ph.tokens.length}
            onClick={checkOrder}
          >
            Check
          </button>
        </div>
      ) : (
        <div className="options-stack" key={`po-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            if (showingFeedback) {
              if (opt.id === ph.id) cls += ' is-correct'
              else if (opt.id === state.pickedId) cls += ' is-wrong'
            }
            return (
              <button
                key={`${state.step}-${opt.id}`}
                type="button"
                className={cls}
                disabled={showingFeedback}
                onClick={() => handlePick(opt)}
              >
                {opt.english}
              </button>
            )
          })}
          {showingFeedback && ph.note && (
            <div className="phrase-note">{ph.note}</div>
          )}
        </div>
      )}
    </div>
  )
}
