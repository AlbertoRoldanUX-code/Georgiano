import { useReducer, useState } from 'react'
import { alphabet } from '../data/alphabet'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'

const SESSION_SIZE = 12

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getOptions(correct, all) {
  const wrong = shuffle(all.filter(l => l.letter !== correct.letter)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

const initial = {
  active: false,
  done: false,
  status: 'prompt', // 'prompt' | 'feedback' — colors ONLY while 'feedback'
  questions: [],
  idx: 0,
  opts: [],
  picked: null,
  score: { c: 0, w: 0 },
  step: 0, // increments every question; used as React remount key
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { questions } = action
      return {
        active: true,
        done: false,
        status: 'prompt',
        questions,
        idx: 0,
        opts: getOptions(questions[0], alphabet),
        picked: null,
        score: { c: 0, w: 0 },
        step: 1,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      const q = state.questions[state.idx]
      const correct = action.picked === q.roman
      return {
        ...state,
        status: 'feedback',
        picked: action.picked,
        score: {
          c: state.score.c + (correct ? 1 : 0),
          w: state.score.w + (correct ? 0 : 1),
        },
      }
    }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt', picked: null }
      }
      return {
        active: true,
        done: false,
        status: 'prompt',
        questions: state.questions,
        idx: next,
        opts: getOptions(state.questions[next], alphabet),
        picked: null,
        score: state.score,
        step: state.step + 1,
      }
    }
    case 'exit':
      return { ...initial }
    default:
      return state
  }
}

export default function AlphabetLesson({ navigate, progressAPI }) {
  const [tab, setTab] = useState('browse')
  const [selected, setSelected] = useState(null)
  const [state, dispatch] = useReducer(reducer, initial)

  const { progress, recordAlphabetSeen } = progressAPI
  const total = state.questions.length || SESSION_SIZE
  const showingFeedback = state.status === 'feedback'

  function startPractice() {
    const questions = shuffle(alphabet).slice(0, SESSION_SIZE)
    dispatch({ type: 'boot', questions })
    setTab('practice')
  }

  function handleSelect(letter) {
    setSelected(selected?.letter === letter.letter ? null : letter)
    recordAlphabetSeen(letter.letter)
  }

  function handlePick(opt) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const correct = opt.roman === q.roman
    dispatch({ type: 'answer', picked: opt.roman })
    if (correct) playCorrectSound()
    else playWrongSound()

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      dispatch({ type: 'next' })
    }, 900)
  }

  if (tab === 'practice' && state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '📚'}</div>
          <h2 className="result-title">Complete!</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            {state.score.c >= total * 0.9 ? 'Excellent!'
              : state.score.c >= total * 0.7 ? 'Nice work. Keep practicing!'
              : 'Keep reviewing the letters.'}
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={startPractice}>Another round</button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { dispatch({ type: 'exit' }); navigate('home') }}
            >
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'practice' && state.active && state.questions.length > 0) {
    const q = state.questions[state.idx]
    return (
      <div className="screen">
        <nav className="nav">
          <button
            type="button"
            className="nav-back"
            onClick={() => { dispatch({ type: 'exit' }); setTab('browse') }}
          >
            ‹
          </button>
          <span className="nav-title">Practice</span>
        </nav>

        <div className="pbar">
          <div className="pbar-fill" style={{ width: `${(state.idx / total) * 100}%` }} />
        </div>

        <div className="quiz-score" style={{ marginBottom: 24 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
            {state.idx + 1}/{total}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {state.score.c}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {state.score.w}</span>
        </div>

        <div className="practice-prompt" key={`q-${state.step}`}>
          <div className="practice-letter">{q.letter}</div>
          <button
            type="button"
            className="sound-btn"
            onClick={() => speakWord(q.example)}
            aria-label="Listen to an example word"
          >
            ▶ Listen
          </button>
          {showingFeedback ? (
            <div className="practice-example">
              <div className="practice-example-geo">{q.example}</div>
              <div className="practice-example-en">{q.exMeaning}</div>
            </div>
          ) : (
            <div className="practice-example practice-example-hidden" aria-hidden="true">
              <div className="practice-example-geo">••••</div>
              <div className="practice-example-en">example hidden</div>
            </div>
          )}
        </div>

        <div className="options-stack" key={`opts-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            // Colors exist ONLY during feedback status for this step
            if (showingFeedback) {
              if (opt.roman === q.roman) cls += ' is-correct'
              else if (opt.roman === state.picked) cls += ' is-wrong'
            }
            return (
              <button
                key={`${state.step}-${opt.roman}`}
                type="button"
                className={cls}
                onClick={() => handlePick(opt)}
                disabled={showingFeedback}
              >
                {opt.roman}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Learn the alphabet</span>
      </nav>

      <div className="alpha-tabs">
        <button
          type="button"
          className={`alpha-tab ${tab === 'browse' ? 'active' : ''}`}
          onClick={() => { setTab('browse'); setSelected(null) }}
        >
          Browse
        </button>
        <button
          type="button"
          className={`alpha-tab ${tab === 'practice' ? 'active' : ''}`}
          onClick={startPractice}
        >
          Practice
        </button>
      </div>

      <div className="letter-grid">
        {alphabet.map(l => (
          <button
            key={l.letter}
            type="button"
            className={`letter-tile ${progress.alphabetSeen.includes(l.letter) ? 'seen' : ''} ${selected?.letter === l.letter ? 'selected' : ''}`}
            onClick={() => handleSelect(l)}
          >
            <span className="letter-geo">{l.letter}</span>
            <span className="letter-roman">{l.roman}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="letter-detail">
          <div className="letter-detail-big">{selected.letter}</div>
          <div className="letter-detail-meta">
            <div className="letter-detail-name">{selected.name}</div>
            <div className="letter-detail-roman">Romanization: <strong>{selected.roman}</strong></div>
            <div className="letter-detail-ipa">IPA: {selected.ipa}</div>
          </div>
          <div className="letter-example">
            <div className="letter-example-geo">{selected.example}</div>
            <div className="letter-example-meaning">{selected.exMeaning}</div>
          </div>
          <button
            type="button"
            className="sound-btn"
            style={{ margin: '12px auto 0', display: 'flex' }}
            onClick={() => speakWord(selected.example)}
          >
            ▶ Listen
          </button>
        </div>
      )}

      {!selected && (
        <p style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '0.875rem', marginTop: 8 }}>
          Tap a letter to see details
        </p>
      )}
    </div>
  )
}
