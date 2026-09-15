import { useState, useEffect, useRef } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

function isCorrect(input, word) {
  const n = normalize(input)
  if (!n) return false
  const accepted = [word.spanish, ...word.alts].map(normalize)
  return accepted.some(a => a === n || a.split('/').map(p => p.trim()).includes(n))
}

export default function TranslationLesson({ navigate, progressAPI, category }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'Todo'

  const [questions] = useState(() => shuffle(pool))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState(null) // null | 'correct' | 'wrong'
  const [history, setHistory] = useState([])
  const [showHint, setShowHint] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const { recordAnswer } = progressAPI

  useEffect(() => {
    setShowHint(false)
    setInput('')
    setStatus(null)
    inputRef.current?.focus()
    timerRef.current = setTimeout(() => setShowHint(true), 4000)
    return () => clearTimeout(timerRef.current)
  }, [idx])

  function handleSubmit(e) {
    e.preventDefault()
    if (status !== null || !input.trim()) return

    const correct = isCorrect(input, questions[idx])
    setStatus(correct ? 'correct' : 'wrong')
    recordAnswer(questions[idx].id, correct)
    setHistory(h => [...h, correct ? 'c' : 'w'])

    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true)
      else setIdx(i => i + 1)
    }, 1200)
  }

  function handleSkip() {
    if (status !== null) return
    setStatus('wrong')
    recordAnswer(questions[idx].id, false)
    setHistory(h => [...h, 'w'])
    setTimeout(() => {
      if (idx + 1 >= questions.length) setDone(true)
      else setIdx(i => i + 1)
    }, 1200)
  }

  const score = history.filter(h => h === 'c').length

  if (done) {
    const pct = Math.round((score / questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">
            {pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📝'}
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
        <span className="nav-title">Traducción · {catTitle}</span>
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

      <div className="trans-card">
        <div style={{ fontSize: '0.8125rem', color: 'var(--text3)', marginBottom: 8 }}>
          Traduce al español:
        </div>
        <div className="q-geo">{q.georgian}</div>
        <div className={`trans-hint ${showHint ? 'visible' : 'hidden'}`}>
          🔤 {q.roman}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-row">
          <input
            ref={inputRef}
            className={`trans-input ${status === 'correct' ? 'correct' : status === 'wrong' ? 'wrong' : ''}`}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Escribe en español…"
            disabled={status !== null}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          <button type="submit" className="submit-btn" disabled={!input.trim() || status !== null}>
            →
          </button>
        </div>
      </form>

      {status === 'correct' && (
        <div className="feedback-msg correct">
          ✓ ¡Correcto! — {q.spanish}
        </div>
      )}
      {status === 'wrong' && (
        <div className="feedback-msg wrong">
          ✗ La respuesta era: <strong>{q.spanish}</strong>
          {q.alts.length > 0 && <span> (también: {q.alts.join(', ')})</span>}
        </div>
      )}

      {status === null && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 4, width: '100%' }}
          onClick={handleSkip}
        >
          No sé — saltar
        </button>
      )}
    </div>
  )
}
