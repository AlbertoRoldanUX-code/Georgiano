import { useReducer } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'
import { playCorrectSound, playWrongSound, unlockAudio } from '../utils/audio'

const SESSION_SIZE = 10

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getOptions(correct, pool) {
  const wrong = shuffle(pool.filter(w => w.id !== correct.id)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

function pickQuestions(pool) {
  return shuffle(pool).slice(0, Math.min(SESSION_SIZE, pool.length))
}

function createRound(pool) {
  const questions = pickQuestions(pool)
  return {
    questions,
    idx: 0,
    opts: getOptions(questions[0], pool),
    questionId: 1,
    feedback: null,
    history: [],
    done: false,
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot':
      return createRound(action.pool)
    case 'answer': {
      if (state.feedback || state.done) return state
      const q = state.questions[state.idx]
      const correct = action.pickedId === q.id
      return {
        ...state,
        feedback: {
          questionId: state.questionId,
          pickedId: action.pickedId,
          correctId: q.id,
        },
        history: [...state.history, correct ? 'c' : 'w'],
      }
    }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, feedback: null }
      }
      return {
        ...state,
        idx: next,
        opts: getOptions(state.questions[next], action.pool),
        questionId: state.questionId + 1,
        feedback: null,
      }
    }
    default:
      return state
  }
}

export default function QuizLesson({ navigate, progressAPI, category }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'All'
  const [state, dispatch] = useReducer(reducer, pool, createRound)
  const { recordAnswer } = progressAPI

  const feedbackLive =
    state.feedback && state.feedback.questionId === state.questionId

  function handlePick(opt) {
    if (feedbackLive || state.done) return
    unlockAudio()
    const q = state.questions[state.idx]
    const correct = opt.id === q.id
    dispatch({ type: 'answer', pickedId: opt.id })
    if (correct) playCorrectSound()
    else playWrongSound()
    recordAnswer(q.id, correct)

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      dispatch({ type: 'next', pool })
    }, 900)
  }

  if (state.done) {
    const score = state.history.filter(h => h === 'c').length
    const pct = Math.round((score / state.questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">
            {pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📖'}
          </div>
          <h2 className="result-title">Round complete!</h2>
          <div className="result-score">{score}/{state.questions.length}</div>
          <div className="result-sub">{catTitle} · {pct}% correct</div>
          <div className="result-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { unlockAudio(); dispatch({ type: 'boot', pool }) }}
            >
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
        <span className="nav-title">Vocabulary · {catTitle}</span>
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

      <div className="practice-prompt" style={{ marginBottom: 28 }}>
        <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '2.25rem' }}>{q.english}</div>
      </div>

      <div className="options-stack" key={state.questionId}>
        {state.opts.map(opt => {
          let cls = 'option-row'
          if (feedbackLive) {
            if (opt.id === state.feedback.correctId) cls += ' correct'
            else if (opt.id === state.feedback.pickedId) cls += ' wrong'
          }
          return (
            <button
              key={`${state.questionId}-${opt.id}`}
              type="button"
              className={cls}
              onPointerDown={unlockAudio}
              onClick={() => handlePick(opt)}
              disabled={feedbackLive}
            >
              <span style={{ fontFamily: 'Sylfaen, BPG Arial, serif', fontSize: '1.25rem' }}>{opt.georgian}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
