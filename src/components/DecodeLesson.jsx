import { useEffect, useReducer, useRef } from 'react'
import { decodeWords, wordLettersReady } from '../data/decodeWords'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'
import { normalize, normalizeLoose } from '../utils/normalize'
import { isDue, letterEntry, recognitionReady } from '../utils/srs'
import { isLetterRecognized } from '../utils/pathUnlock'

const SESSION_SIZE = 10

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function matchesWordRoman(input, word) {
  const n = normalize(input)
  const loose = normalizeLoose(input)
  if (!n) return false
  const roman = normalize(word.roman)
  const romanLoose = normalizeLoose(word.roman)
  return n === roman || loose === romanLoose
}

function poolFor(progress) {
  const ready = decodeWords.filter(w =>
    wordLettersReady(w.georgian, ch => isLetterRecognized(progress, ch))
  )
  // Fallback: if few letters mastered, still allow shortest words
  if (ready.length >= 6) return ready
  return decodeWords
    .slice()
    .sort((a, b) => [...a.georgian].length - [...b.georgian].length)
}

function pickSession(progress, size = SESSION_SIZE) {
  const pool = poolFor(progress)
  const scored = pool.map(w => {
    const card = progress.words?.[w.id]?.decode
    let weight = Math.random() * 5
    if (!card?.attempts) weight += 25
    else if (isDue(card)) weight += 20
    if (card?.attempts && card.correct / card.attempts < 0.65) weight += 15
    return { w, weight }
  })
  scored.sort((a, b) => b.weight - a.weight)
  const words = scored.slice(0, Math.min(size, scored.length)).map(s => s.w)

  return words.map((w, i) => {
    // Mix: romanize, listen-match, meaning (light)
    const roll = (i + w.id.length) % 3
    if (roll === 0) return { kind: 'romanize', word: w }
    if (roll === 1) return { kind: 'listen', word: w }
    return { kind: 'meaning', word: w }
  })
}

function englishOpts(correct, pool) {
  const wrong = shuffle(pool.filter(w => w.id !== correct.id)).slice(0, 3)
  return shuffle([correct, ...wrong])
}

function geoOpts(correct, pool) {
  return englishOpts(correct, pool)
}

const initial = {
  active: false,
  done: false,
  status: 'prompt',
  questions: [],
  idx: 0,
  opts: [],
  pickedId: null,
  typed: '',
  score: { c: 0, w: 0 },
  step: 0,
  showRoman: true,
}

function optsFor(q, pool) {
  if (!q) return []
  if (q.kind === 'listen') return geoOpts(q.word, pool)
  if (q.kind === 'meaning') return englishOpts(q.word, pool)
  return []
}

function reducer(state, action) {
  switch (action.type) {
    case 'boot': {
      const { questions, pool } = action
      return {
        ...initial,
        active: true,
        questions,
        opts: optsFor(questions[0], pool),
        pool,
        step: 1,
        showRoman: action.showRoman,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      return {
        ...state,
        status: 'feedback',
        pickedId: action.pickedId ?? null,
        typed: action.typed ?? state.typed,
        score: {
          c: state.score.c + (action.correct ? 1 : 0),
          w: state.score.w + (action.correct ? 0 : 1),
        },
      }
    }
    case 'type':
      if (state.status !== 'prompt') return state
      return { ...state, typed: action.value }
    case 'next': {
      const next = state.idx + 1
      if (next >= state.questions.length) {
        return { ...state, done: true, status: 'prompt', pickedId: null, typed: '' }
      }
      return {
        ...state,
        idx: next,
        opts: optsFor(state.questions[next], state.pool),
        status: 'prompt',
        pickedId: null,
        typed: '',
        step: state.step + 1,
      }
    }
    case 'exit':
      return { ...initial }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'romanize') return 'Type how it sounds (romanization)'
  if (kind === 'listen') return 'Listen, then pick the word'
  return 'What does this mean?'
}

export default function DecodeLesson({ navigate, progressAPI }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const inputRef = useRef(null)
  const { progress, recordWordResult, recordSkillRound, recordAnswer } = progressAPI
  const total = state.questions.length || SESSION_SIZE
  const showingFeedback = state.status === 'feedback'

  // Fade romanization as decode skill grows
  const decodeAttempts = progress.skills?.decode?.attempts || 0
  const showRomanDefault = decodeAttempts < 25

  useEffect(() => {
    if (!state.active || state.done) return
    const q = state.questions[state.idx]
    if (q?.kind === 'romanize' && state.status === 'prompt') {
      inputRef.current?.focus()
    }
  }, [state.active, state.done, state.idx, state.status, state.questions])

  function start() {
    const recognizedCount = decodeWords.filter(w =>
      wordLettersReady(w.georgian, ch => recognitionReady(letterEntry(progress, ch).recognition))
    ).length
    const questions = pickSession(progress, SESSION_SIZE)
    const pool = poolFor(progress)
    dispatch({
      type: 'boot',
      questions,
      pool,
      showRoman: showRomanDefault || recognizedCount < 10,
    })
  }

  // Auto-start on mount
  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const skill =
      q.kind === 'listen' ? 'listening'
      : q.kind === 'meaning' ? 'meaning'
      : 'decode'
    const finalCorrect = state.score.c + (correct ? 1 : 0)
    const willFinish = state.idx + 1 >= total

    dispatch({ type: 'answer', correct, ...extra })
    recordWordResult(q.word.id, skill, correct)
    recordAnswer(q.word.id, correct, 'decode')
    if (correct) playCorrectSound()
    else playWrongSound()

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) {
        recordSkillRound('decode', Math.round((finalCorrect / total) * 100))
      }
      dispatch({ type: 'next' })
    }, 1100)
  }

  function handlePick(opt) {
    const q = state.questions[state.idx]
    finish(opt.id === q.word.id, { pickedId: opt.id })
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!state.typed.trim()) return
    const q = state.questions[state.idx]
    finish(matchesWordRoman(state.typed, q.word), { typed: state.typed })
  }

  if (state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '📖'}</div>
          <h2 className="result-title">Decode complete</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            You are bridging letters into real words. Keep reading Georgian directly when you can.
          </div>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={start}>Another round</button>
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
          <span className="nav-title">Word Decode</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const word = q.word

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Word Decode</span>
      </nav>

      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${(state.idx / total) * 100}%` }} />
      </div>

      <div className="quiz-score" style={{ marginBottom: 16 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
          {state.idx + 1}/{total}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {state.score.c}</span>
        <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {state.score.w}</span>
      </div>

      <p className="practice-kind">{kindLabel(q.kind)}</p>

      <div className="practice-prompt" key={`dq-${state.step}`}>
        {q.kind === 'listen' ? (
          <button
            type="button"
            className="sound-btn sound-btn-lg"
            onClick={() => speakWord(word.georgian)}
          >
            ▶ Listen
          </button>
        ) : (
          <>
            <div className="practice-letter decode-word">{word.georgian}</div>
            {state.showRoman && q.kind === 'meaning' && (
              <div className="decode-roman-hint">{word.roman}</div>
            )}
            {q.kind !== 'listen' && (
              <button
                type="button"
                className="sound-btn"
                onClick={() => speakWord(word.georgian)}
              >
                ▶ Listen
              </button>
            )}
          </>
        )}
      </div>

      {q.kind === 'romanize' ? (
        <form className="recall-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={`trans-input${showingFeedback ? (matchesWordRoman(state.typed, word) ? ' correct' : ' wrong') : ''}`}
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
              <div>{word.georgian} → <strong>{word.roman}</strong></div>
              <div style={{ color: 'var(--text3)', marginTop: 4 }}>{word.english}</div>
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
        <div className="options-stack" key={`dopts-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            if (showingFeedback) {
              if (opt.id === word.id) cls += ' is-correct'
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
                {q.kind === 'listen' ? (
                  <span className="option-geo">{opt.georgian}</span>
                ) : (
                  opt.english
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
