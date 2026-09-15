import { useReducer } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'

const SESSION_SIZE = 10

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function pickQuestions(pool) {
  return shuffle(pool).slice(0, Math.min(SESSION_SIZE, pool.length))
}

function englishOpts(correct, pool) {
  const wrong = shuffle(pool.filter(w => w.id !== correct.id)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

function georgianOpts(correct, pool) {
  return englishOpts(correct, pool)
}

/**
 * mode:
 *  listen — hear word, pick English
 *  read   — see Georgian, pick English
 *  speak  — see English, pick Georgian (+ Listen model)
 */
function createRound(pool, mode) {
  const questions = pickQuestions(pool)
  const first = questions[0]
  return {
    mode,
    questions,
    idx: 0,
    opts: mode === 'speak' ? georgianOpts(first, pool) : englishOpts(first, pool),
    status: 'prompt',
    pickedId: null,
    history: [],
    done: false,
    step: 1,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot':
      return createRound(action.pool, action.mode)
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      const q = state.questions[state.idx]
      const correct = action.pickedId === q.id
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId,
        history: [...state.history, correct ? 'c' : 'w'],
      }
    }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt', pickedId: null }
      }
      const q = state.questions[next]
      const opts =
        state.mode === 'speak'
          ? georgianOpts(q, action.pool)
          : englishOpts(q, action.pool)
      return {
        ...state,
        idx: next,
        opts,
        status: 'prompt',
        pickedId: null,
        step: state.step + 1,
      }
    }
    default:
      return state
  }
}

const TITLES = {
  listen: 'Listen',
  read: 'Read',
  speak: 'Speak',
}

export default function SkillLesson({ navigate, progressAPI, category, mode }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'All'
  const [state, dispatch] = useReducer(reducer, null, () => createRound(pool, mode))
  const { recordAnswer, recordSkillRound } = progressAPI
  const showingFeedback = state.status === 'feedback'

  function handlePick(opt) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const correct = opt.id === q.id
    const nextHistory = [...state.history, correct ? 'c' : 'w']
    const willFinish = state.idx + 1 >= state.questions.length
    dispatch({ type: 'answer', pickedId: opt.id })
    if (correct) playCorrectSound()
    else playWrongSound()
    recordAnswer(q.id, correct, mode)
    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) {
        const score = nextHistory.filter(h => h === 'c').length
        recordSkillRound(mode, Math.round((score / state.questions.length) * 100))
      }
      dispatch({ type: 'next', pool })
    }, 900)
  }

  if (state.done) {
    const score = state.history.filter(h => h === 'c').length
    const pct = Math.round((score / state.questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📖'}</div>
          <h2 className="result-title">Round complete!</h2>
          <div className="result-score">{score}/{state.questions.length}</div>
          <div className="result-sub">{TITLES[mode]} · {catTitle} · {pct}%</div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'boot', pool, mode })}>
              Again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const score = state.history.filter(h => h === 'c').length

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">{TITLES[mode]} · {catTitle}</span>
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

      <div className="practice-prompt" style={{ marginBottom: 28 }} key={`p-${state.step}`}>
        {mode === 'listen' && (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text3)', marginBottom: 12 }}>
              Listen, then choose the meaning
            </div>
            <button type="button" className="sound-btn sound-btn-lg" onClick={() => speakWord(q.georgian)}>
              ▶ Listen
            </button>
          </>
        )}
        {mode === 'read' && (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text3)', marginBottom: 8 }}>
              What does this mean?
            </div>
            <div className="q-geo">{q.georgian}</div>
          </>
        )}
        {mode === 'speak' && (
          <>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text3)', marginBottom: 8 }}>
              How do you say this? Listen, then choose
            </div>
            <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '2rem' }}>{q.english}</div>
            <button
              type="button"
              className="sound-btn"
              style={{ marginTop: 14 }}
              onClick={() => speakWord(q.georgian)}
            >
              ▶ Hear model
            </button>
          </>
        )}
      </div>

      <div className="options-stack" key={state.step}>
        {state.opts.map(opt => {
          let cls = 'option-row'
          if (showingFeedback) {
            if (opt.id === q.id) cls += ' is-correct'
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
              {mode === 'speak' ? (
                <span style={{ fontFamily: 'Sylfaen, BPG Arial, serif', fontSize: '1.25rem' }}>{opt.georgian}</span>
              ) : (
                opt.english
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
