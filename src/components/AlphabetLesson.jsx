import { useState, useEffect } from 'react'
import { alphabet } from '../data/alphabet'
import {
  playSelectSound,
  playCorrectSound,
  playWrongSound,
  speakWord,
} from '../utils/audio'

/** Duolingo-style short round (~2–5 min). */
const SESSION_SIZE = 12

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getOptions(correct, all) {
  const wrong = shuffle(all.filter(l => l.letter !== correct.letter)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

export default function AlphabetLesson({ navigate, progressAPI }) {
  const [tab, setTab] = useState('browse')
  const [selected, setSelected] = useState(null)

  const [questions, setQuestions] = useState([])
  const [qIdx, setQIdx] = useState(0)
  const [opts, setOpts] = useState([])
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ c: 0, w: 0 })
  const [done, setDone] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  const { progress, recordAlphabetSeen } = progressAPI
  const total = questions.length || SESSION_SIZE

  function startPractice() {
    const qs = shuffle(alphabet).slice(0, SESSION_SIZE)
    setQuestions(qs)
    setQIdx(0)
    setOpts(getOptions(qs[0], alphabet))
    setPicked(null)
    setScore({ c: 0, w: 0 })
    setDone(false)
    setSessionKey(k => k + 1)
    setTab('practice')
  }

  useEffect(() => {
    if (tab === 'practice' && questions[qIdx] && qIdx > 0) {
      setOpts(getOptions(questions[qIdx], alphabet))
      setPicked(null)
    }
  }, [qIdx, tab, sessionKey])

  function handleSelect(letter) {
    setSelected(selected?.letter === letter.letter ? null : letter)
    recordAlphabetSeen(letter.letter)
  }

  function handlePick(opt) {
    if (picked) return
    playSelectSound()
    setPicked(opt.roman)
    const correct = opt.roman === questions[qIdx].roman
    if (correct) playCorrectSound()
    else playWrongSound()
    setScore(s => ({ c: s.c + (correct ? 1 : 0), w: s.w + (correct ? 0 : 1) }))
    setTimeout(() => {
      document.activeElement?.blur?.()
      if (qIdx + 1 >= questions.length) setDone(true)
      else setQIdx(i => i + 1)
    }, 900)
  }

  if (tab === 'practice' && done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{score.c >= total * 0.8 ? '🏆' : '📚'}</div>
          <h2 className="result-title">Complete!</h2>
          <div className="result-score">{score.c}/{total}</div>
          <div className="result-sub">
            {score.c >= total * 0.9 ? 'Excellent!'
              : score.c >= total * 0.7 ? 'Nice work. Keep practicing!'
              : 'Keep reviewing the letters.'}
          </div>
          <div className="result-actions">
            <button className="btn btn-primary" onClick={startPractice}>Another round</button>
            <button className="btn btn-ghost" onClick={() => navigate('home')}>Home</button>
          </div>
        </div>
      </div>
    )
  }

  if (tab === 'practice' && questions.length > 0) {
    const q = questions[qIdx]
    return (
      <div className="screen">
        <nav className="nav">
          <button className="nav-back" onClick={() => setTab('browse')}>‹</button>
          <span className="nav-title">Practice</span>
        </nav>

        <div className="pbar">
          <div className="pbar-fill" style={{ width: `${(qIdx / total) * 100}%` }} />
        </div>

        <div className="quiz-score" style={{ marginBottom: 24 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
            {qIdx + 1}/{total}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {score.c}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {score.w}</span>
        </div>

        <div className="practice-prompt">
          <div className="practice-letter">{q.letter}</div>
          <div className="practice-example">
            <div className="practice-example-geo">{q.example}</div>
            <div className="practice-example-en">{q.exMeaning}</div>
          </div>
          <button
            type="button"
            className="sound-btn"
            onClick={() => speakWord(q.example)}
            aria-label="Listen to the example word"
          >
            ▶ Listen
          </button>
        </div>

        <div className="options-stack">
          {opts.map(opt => {
            let cls = 'option-row'
            if (picked) {
              if (opt.roman === questions[qIdx].roman) cls += ' correct'
              else if (picked === opt.roman) cls += ' wrong'
            }
            return (
              <button
                key={`${qIdx}-${opt.roman}`}
                className={cls}
                onClick={() => handlePick(opt)}
                disabled={!!picked}
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
        <button className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Learn the alphabet</span>
      </nav>

      <div className="alpha-tabs">
        <button
          className={`alpha-tab ${tab === 'browse' ? 'active' : ''}`}
          onClick={() => { setTab('browse'); setSelected(null) }}
        >
          Browse
        </button>
        <button className={`alpha-tab ${tab === 'practice' ? 'active' : ''}`} onClick={startPractice}>
          Practice
        </button>
      </div>

      <div className="letter-grid">
        {alphabet.map(l => (
          <button
            key={l.letter}
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
