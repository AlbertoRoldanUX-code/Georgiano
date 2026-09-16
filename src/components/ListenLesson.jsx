import { useEffect, useReducer, useRef } from 'react'
import { alphabet } from '../data/alphabet'
import { allWords } from '../data/vocabulary'
import { getListenLevel, wordsForListenLevel } from '../data/levels'
import { playCorrectSound, playWrongSound, speakLetter, speakWord } from '../utils/audio'
import { normalize, normalizeLoose } from '../utils/normalize'
import { recognitionOptions, shuffle } from '../utils/srs'
import { mcqOptions, pickSpacedItems } from '../utils/sessionPick'

const SESSION_SIZE = 10

function matchesRomanText(input, roman) {
  const n = normalize(input)
  if (!n) return false
  return n === normalize(roman) || normalizeLoose(input) === normalizeLoose(roman)
}

function buildSession(progress, pool) {
  const words = pickSpacedItems(
    progress,
    pool,
    (w, p) => p.words?.[w.id]?.listening,
    Math.min(8, pool.length),
  )
  const includeLetters = pool.length <= 30 || pool.every(w => [...w.georgian].length <= 5)
  const letters = includeLetters
    ? pickSpacedItems(
      progress,
      alphabet,
      (l, p) => p.letters?.[l.letter]?.recognition,
      4,
    ).slice(0, 2)
    : []

  const items = []
  let i = 0
  for (const w of words) {
    const roll = i % 3
    if (roll === 0) items.push({ kind: 'listen_meaning', word: w })
    else if (roll === 1) items.push({ kind: 'listen_geo', word: w })
    else items.push({ kind: 'dictation', word: w })
    i++
  }
  for (const letter of letters) {
    items.push({ kind: 'letter_listen', letter })
  }
  return shuffle(items).slice(0, SESSION_SIZE)
}

function optsFor(q, pool) {
  if (!q) return []
  if (q.kind === 'listen_meaning') return mcqOptions(q.word, pool)
  if (q.kind === 'listen_geo') return mcqOptions(q.word, pool)
  if (q.kind === 'letter_listen') return recognitionOptions(q.letter, alphabet)
  return []
}

const initial = {
  active: false,
  done: false,
  status: 'prompt',
  questions: [],
  pool: [],
  idx: 0,
  opts: [],
  pickedId: null,
  pickedLetter: null,
  typed: '',
  history: [],
  step: 0,
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { questions, pool } = action
      return {
        ...initial,
        active: true,
        questions,
        pool,
        opts: optsFor(questions[0], pool),
        step: 1,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId ?? null,
        pickedLetter: action.pickedLetter ?? null,
        typed: action.typed ?? state.typed,
        history: [...state.history, action.correct ? 'c' : 'w'],
      }
    }
    case 'type':
      if (state.status !== 'prompt') return state
      return { ...state, typed: action.value }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt' }
      }
      return {
        ...state,
        idx: next,
        opts: optsFor(state.questions[next], state.pool),
        status: 'prompt',
        pickedId: null,
        pickedLetter: null,
        typed: '',
        step: state.step + 1,
      }
    }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'letter_listen') return 'Listen — which letter?'
  if (kind === 'listen_geo') return 'Listen — pick the Georgian word'
  if (kind === 'dictation') return 'Listen — type what you hear (romanization)'
  return 'Listen — pick the meaning'
}

export default function ListenLesson({ navigate, progressAPI, level }) {
  const levelMeta = getListenLevel(level)
  const pool = level ? wordsForListenLevel(level) : allWords
  const title = levelMeta ? levelMeta.title : 'All levels'
  const [state, dispatch] = useReducer(reducer, initial)
  const inputRef = useRef(null)
  const {
    progress,
    recordAnswer,
    recordSkillRound,
    recordListenLevelRound,
    recordWordResult,
    recordLetterResult,
  } = progressAPI
  const showingFeedback = state.status === 'feedback'

  function start() {
    const questions = buildSession(progress, pool)
    dispatch({ type: 'boot', questions, pool })
  }

  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  useEffect(() => {
    if (!state.active || state.done) return
    const q = state.questions[state.idx]
    if (q?.kind === 'dictation' && state.status === 'prompt') inputRef.current?.focus()
  }, [state.active, state.done, state.idx, state.status, state.questions])

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const nextHistory = [...state.history, correct ? 'c' : 'w']
    const willFinish = state.idx + 1 >= state.questions.length

    dispatch({ type: 'answer', correct, ...extra })
    if (correct) playCorrectSound()
    else playWrongSound()

    if (q.kind === 'letter_listen') {
      recordLetterResult(q.letter.letter, 'recognition', correct, extra.confusedWith || null)
    } else {
      recordWordResult(q.word.id, 'listening', correct)
      recordAnswer(q.word.id, correct, 'listen')
    }

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) {
        const score = nextHistory.filter(h => h === 'c').length
        const pct = Math.round((score / state.questions.length) * 100)
        recordSkillRound('listen', pct)
        if (level) recordListenLevelRound(level, pct)
      }
      dispatch({ type: 'next' })
    }, 1000)
  }

  function playPrompt() {
    const q = state.questions[state.idx]
    if (q.kind === 'letter_listen') speakLetter(q.letter.letter)
    else speakWord(q.word.georgian)
  }

  function handlePickWord(opt) {
    const q = state.questions[state.idx]
    finish(opt.id === q.word.id, { pickedId: opt.id })
  }

  function handlePickLetter(opt) {
    const q = state.questions[state.idx]
    const correct = opt.letter === q.letter.letter
    finish(correct, {
      pickedLetter: opt.letter,
      confusedWith: correct ? null : opt.letter,
    })
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!state.typed.trim()) return
    const q = state.questions[state.idx]
    finish(matchesRomanText(state.typed, q.word.roman), { typed: state.typed })
  }

  if (state.done) {
    const score = state.history.filter(h => h === 'c').length
    const pct = Math.round((score / state.questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{pct >= 90 ? '🏆' : pct >= 70 ? '🎧' : '👂'}</div>
          <h2 className="result-title">Listening done</h2>
          <div className="result-score">{score}/{state.questions.length}</div>
          <div className="result-sub">{title} · {pct}%</div>
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
          <span className="nav-title">Listen · {title}</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const score = state.history.filter(h => h === 'c').length

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Listen · {title}</span>
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

      <div className="practice-prompt" key={`lp-${state.step}`}>
        <button type="button" className="sound-btn sound-btn-lg" onClick={playPrompt}>
          ▶ Listen
        </button>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 8 }} onClick={playPrompt}>
          Replay
        </button>
      </div>

      {q.kind === 'dictation' ? (
        <form className="recall-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={`trans-input${showingFeedback ? (matchesRomanText(state.typed, q.word.roman) ? ' correct' : ' wrong') : ''}`}
            value={state.typed}
            onChange={e => dispatch({ type: 'type', value: e.target.value })}
            placeholder="Type romanization…"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            disabled={showingFeedback}
          />
          {showingFeedback && (
            <div className="recall-answer">
              <div><strong>{q.word.georgian}</strong> · {q.word.roman}</div>
              <div style={{ color: 'var(--text3)', marginTop: 4 }}>{q.word.english}</div>
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={showingFeedback || !state.typed.trim()}
            style={{ width: '100%', marginTop: 12 }}
          >
            Check
          </button>
        </form>
      ) : (
        <div className="options-stack" key={`lo-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            if (showingFeedback) {
              if (q.kind === 'letter_listen') {
                if (opt.letter === q.letter.letter) cls += ' is-correct'
                else if (opt.letter === state.pickedLetter) cls += ' is-wrong'
              } else {
                if (opt.id === q.word.id) cls += ' is-correct'
                else if (opt.id === state.pickedId) cls += ' is-wrong'
              }
            }
            return (
              <button
                key={`${state.step}-${opt.id || opt.letter}`}
                type="button"
                className={cls}
                disabled={showingFeedback}
                onClick={() => (q.kind === 'letter_listen' ? handlePickLetter(opt) : handlePickWord(opt))}
              >
                {q.kind === 'letter_listen' && <span className="option-geo">{opt.letter}</span>}
                {q.kind === 'listen_geo' && <span className="option-geo">{opt.georgian}</span>}
                {q.kind === 'listen_meaning' && opt.english}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
