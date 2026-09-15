import { useState, useEffect, useRef } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'
import { alphabet } from '../data/alphabet'

const GEO_LETTERS = alphabet.map(l => l.letter)

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

  const [questions] = useState(() => shuffle(pool).slice(0, 10))
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [showHint, setShowHint] = useState(false)
  const [done, setDone] = useState(false)
  const timerRef = useRef(null)

  const { recordAnswer, recordSkillRound } = progressAPI
  const locked = status !== null

  useEffect(() => {
    setShowHint(false)
    setInput('')
    setStatus(null)
    timerRef.current = setTimeout(() => setShowHint(true), 4000)
    return () => clearTimeout(timerRef.current)
  }, [idx])

  function finishAnswer(correct) {
    setStatus(correct ? 'correct' : 'wrong')
    recordAnswer(questions[idx].id, correct, 'write')
    const nextHistory = [...history, correct ? 'c' : 'w']
    setHistory(nextHistory)
    setTimeout(() => {
      if (idx + 1 >= questions.length) {
        const sc = nextHistory.filter(h => h === 'c').length
        recordSkillRound('write', Math.round((sc / questions.length) * 100))
        setDone(true)
      } else {
        setIdx(i => i + 1)
      }
    }, 1200)
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (locked || !input.trim()) return
    finishAnswer(isCorrect(input, questions[idx]))
  }

  function handleSkip() {
    if (locked) return
    finishAnswer(false)
  }

  function typeLetter(letter) {
    if (locked) return
    setInput(v => v + letter)
  }

  function backspace() {
    if (locked) return
    setInput(v => v.slice(0, -1))
  }

  function clearAll() {
    if (locked) return
    setInput('')
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
            <button type="button" className="btn btn-primary" onClick={() => { setIdx(0); setHistory([]); setDone(false) }}>
              Again
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  const q = questions[idx]

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Write · {catTitle}</span>
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
          Type in Georgian:
        </div>
        <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '2rem' }}>{q.english}</div>
        <div className={`trans-hint ${showHint ? 'visible' : 'hidden'}`}>
          Hint: starts with «{q.georgian[0]}»
        </div>
      </div>

      <div className={`write-display ${status === 'correct' ? 'correct' : status === 'wrong' ? 'wrong' : ''}`}>
        {input || <span className="write-placeholder">Tap letters below…</span>}
      </div>

      <div className="geo-keyboard" aria-label="Georgian alphabet keyboard">
        {GEO_LETTERS.map(letter => (
          <button
            key={letter}
            type="button"
            className="geo-key"
            disabled={locked}
            onClick={() => typeLetter(letter)}
          >
            {letter}
          </button>
        ))}
        <button type="button" className="geo-key geo-key-wide" disabled={locked} onClick={backspace}>
          ⌫
        </button>
        <button type="button" className="geo-key geo-key-wide" disabled={locked} onClick={clearAll}>
          Clear
        </button>
        <button
          type="button"
          className="geo-key geo-key-check"
          disabled={locked || !input.trim()}
          onClick={handleSubmit}
        >
          Check →
        </button>
      </div>

      {status === 'correct' && (
        <div className="feedback-msg correct">
          ✓ Correct! — {q.georgian}
        </div>
      )}
      {status === 'wrong' && (
        <div className="feedback-msg wrong">
          ✗ Answer: <strong>{q.georgian}</strong>
        </div>
      )}

      {status === null && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 10, width: '100%' }} onClick={handleSkip}>
          Skip
        </button>
      )}
    </div>
  )
}
