import { useState, useEffect, useRef } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function normalize(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['ʼʹ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function isCorrect(input, word) {
  const n = normalize(input)
  if (!n) return false
  const accepted = [word.georgian, word.roman].map(normalize)
  const romanLoose = normalize(word.roman.replace(/'/g, ''))
  return accepted.some(a => a === n) || n === romanLoose
}

export default function TranslationLesson({ navigate, progressAPI, category }) {
  const pool = category ? vocabulary[category].words : allWords
  const catTitle = category ? vocabulary[category].title : 'All'

  const [questions] = useState(() => shuffle(pool).slice(0, 12))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState(null)
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
          <h2 className="result-title">Round complete!</h2>
          <div className="result-score">{score}/{questions.length}</div>
          <div className="result-sub">{catTitle} · {pct}% correct</div>
          <div className="result-actions">
            <button className="btn btn-primary" onClick={() => { setIdx(0); setHistory([]); setDone(false) }}>
              Again
            </button>
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
        <span className="nav-title">Translation · {catTitle}</span>
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
          Translate to Georgian:
        </div>
        <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '2rem' }}>{q.english}</div>
        <div className={`trans-hint ${showHint ? 'visible' : 'hidden'}`}>
          Hint: starts with «{q.georgian[0]}»
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
            placeholder="Georgian or romanization…"
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
          ✓ Correct! — {q.georgian} ({q.roman})
        </div>
      )}
      {status === 'wrong' && (
        <div className="feedback-msg wrong">
          ✗ Answer: <strong>{q.georgian}</strong> ({q.roman})
        </div>
      )}

      {status === null && (
        <button
          className="btn btn-ghost"
          style={{ marginTop: 4, width: '100%' }}
          onClick={handleSkip}
        >
          Skip
        </button>
      )}
    </div>
  )
}
