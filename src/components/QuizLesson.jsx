import { useState, useEffect } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'
import { playSelectSound, playCorrectSound, playWrongSound } from '../utils/audio'

/** Duolingo-style short round (~2–3 min). */
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

export default function QuizLesson({ navigate, progressAPI, category }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'All'

  const [questions, setQuestions] = useState(() => pickQuestions(pool))
  const [idx, setIdx] = useState(0)
  const [opts, setOpts] = useState(() => getOptions(questions[0], pool))
  const [picked, setPicked] = useState(null)
  const [history, setHistory] = useState([])
  const [done, setDone] = useState(false)

  const { recordAnswer } = progressAPI

  useEffect(() => {
    if (questions[idx]) {
      setOpts(getOptions(questions[idx], pool))
      setPicked(null)
    }
  }, [idx, questions])

  function startRound() {
    const qs = pickQuestions(pool)
    setQuestions(qs)
    setIdx(0)
    setOpts(getOptions(qs[0], pool))
    setPicked(null)
    setHistory([])
    setDone(false)
  }

  function handlePick(opt) {
    if (picked !== null) return
    playSelectSound()
    setPicked(opt.id)
    const correct = opt.id === questions[idx].id
    if (correct) playCorrectSound()
    else playWrongSound()
    recordAnswer(questions[idx].id, correct)
    setHistory(h => [...h, correct ? 'c' : 'w'])

    setTimeout(() => {
      document.activeElement?.blur?.()
      if (idx + 1 >= questions.length) setDone(true)
      else setIdx(i => i + 1)
    }, 900)
  }

  const score = history.filter(h => h === 'c').length

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">
            {pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📖'}
          </div>
          <h2 className="result-title">Round complete!</h2>
          <div className="result-score">{score}/{questions.length}</div>
          <div className="result-sub">{catTitle} · {pct}% correct</div>
          <div className="result-actions">
            <button className="btn btn-primary" onClick={startRound}>Again</button>
            <button className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[idx]

  return (
    <div className="screen">
      <nav className="nav">
        <button className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Vocabulary · {catTitle}</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      <div className="quiz-score">
        {history.map((h, i) => (
          <div key={i} className={`score-dot ${h}`} />
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--text3)', marginLeft: 6 }}>
          {idx + 1}/{questions.length}
        </span>
      </div>

      <div className="practice-prompt" style={{ marginBottom: 28 }}>
        <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '2.25rem' }}>{q.english}</div>
      </div>

      <div className="options-stack">
        {opts.map(opt => {
          let cls = 'option-row'
          if (picked !== null) {
            if (opt.id === q.id) cls += ' correct'
            else if (picked === opt.id) cls += ' wrong'
          }
          return (
            <button
              key={`${idx}-${opt.id}`}
              className={cls}
              onClick={() => handlePick(opt)}
              disabled={picked !== null}
            >
              <span style={{ fontFamily: 'Sylfaen, BPG Arial, serif', fontSize: '1.25rem' }}>{opt.georgian}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
