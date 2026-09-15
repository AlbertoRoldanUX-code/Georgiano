import { useState, useEffect } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getOptions(correct, pool) {
  const wrong = shuffle(pool.filter(w => w.spanish !== correct.spanish)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

export default function QuizLesson({ navigate, progressAPI, category }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'Todo'

  const [questions] = useState(() => shuffle(pool))
  const [idx, setIdx] = useState(0)
  const [opts, setOpts] = useState(() => getOptions(questions[0], pool))
  const [picked, setPicked] = useState(null)
  const [history, setHistory] = useState([]) // 'c' | 'w'
  const [done, setDone] = useState(false)

  const { recordAnswer } = progressAPI

  useEffect(() => {
    if (questions[idx]) {
      setOpts(getOptions(questions[idx], pool))
      setPicked(null)
    }
  }, [idx])

  function handlePick(opt) {
    if (picked !== null) return
    setPicked(opt.spanish)
    const correct = opt.spanish === questions[idx].spanish
    recordAnswer(questions[idx].id, correct)
    setHistory(h => [...h, correct ? 'c' : 'w'])

    setTimeout(() => {
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
          <h2 className="result-title">¡Ronda completada!</h2>
          <div className="result-score">{score}/{questions.length}</div>
          <div className="result-sub">{catTitle} · {pct}% correcto</div>
          <div className="result-actions">
            <button className="btn btn-primary" onClick={() => { setIdx(0); setHistory([]); setDone(false) }}>
              Repetir
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('home')}>Inicio</button>
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
        <span className="nav-title">Vocabulario · {catTitle}</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(idx / questions.length) * 100}%` }} />
      </div>

      <div className="quiz-score">
        {history.map((h, i) => (
          <div key={i} className={`score-dot ${h}`} />
        ))}
        {idx < questions.length && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text3)', marginLeft: 6 }}>
            {idx + 1}/{questions.length}
          </span>
        )}
      </div>

      <div className="question-card">
        <div className="q-geo">{q.georgian}</div>
        <div className="q-roman">{q.roman}</div>
        <div style={{ marginTop: 16, fontSize: '0.875rem', color: 'var(--text2)' }}>
          ¿Qué significa en español?
        </div>
      </div>

      <div className="options">
        {opts.map(opt => {
          let cls = 'option-btn'
          if (picked !== null) {
            if (opt.spanish === q.spanish) cls += ' correct'
            else if (picked === opt.spanish) cls += ' wrong'
          }
          return (
            <button
              key={opt.id}
              className={cls}
              onClick={() => handlePick(opt)}
              disabled={picked !== null}
            >
              {opt.spanish}
            </button>
          )
        })}
      </div>
    </div>
  )
}
