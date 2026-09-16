import { useEffect, useReducer } from 'react'
import { allWords } from '../data/vocabulary'
import { alphabet } from '../data/alphabet'
import { getLevel, itemsForLevel } from '../data/levels'
import { playCorrectSound, playWrongSound, speakWord } from '../utils/audio'
import { normalize, normalizeLoose } from '../utils/normalize'
import { mcqOptions, pickSpacedItems } from '../utils/sessionPick'

const SESSION_SIZE = 10
const GEO_LETTERS = alphabet.map(l => l.letter)

function matchesGeoOrRoman(input, word) {
  const n = normalize(input)
  if (!n) return false
  const accepted = [word.georgian, word.roman, ...(word.alts || [])].map(normalize)
  return accepted.includes(n) || normalizeLoose(input) === normalizeLoose(word.roman)
}

/**
 * One word → several modalities across the path of a session.
 * ~ see → hear → meaning → produce
 */
function buildSession(progress, pool) {
  const words = pickSpacedItems(
    progress,
    pool,
    (w, p) => {
      const e = p.words?.[w.id]
      if (!e) return null
      // Prefer the weakest skill card
      const cards = [e.reading, e.listening, e.meaning, e.produce].filter(Boolean)
      if (!cards.length) return null
      return cards.sort((a, b) => (a.level || 0) - (b.level || 0))[0]
    },
    Math.min(SESSION_SIZE, pool.length),
  )

  const kindsCycle = ['read_meaning', 'listen_meaning', 'produce_pick', 'produce_type']
  const listenAttempts = progress.skills?.listen?.attempts || 0
  const showRoman = listenAttempts < 40 && (progress.skills?.words?.attempts || 0) < 30

  return words.map((w, i) => ({
    kind: kindsCycle[i % kindsCycle.length],
    word: w,
    showRoman,
  }))
}

function optsFor(q, pool) {
  if (!q) return []
  if (q.kind === 'produce_pick') return mcqOptions(q.word, pool)
  if (q.kind === 'read_meaning' || q.kind === 'listen_meaning') return mcqOptions(q.word, pool)
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
        typed: '',
        step: state.step + 1,
      }
    }
    default:
      return state
  }
}

function kindLabel(kind) {
  if (kind === 'listen_meaning') return 'Listen — what does it mean?'
  if (kind === 'produce_pick') return 'How do you say this?'
  if (kind === 'produce_type') return 'Type it in Georgian'
  return 'Read — what does it mean?'
}

function skillFor(kind) {
  if (kind === 'listen_meaning') return 'listening'
  if (kind === 'produce_pick' || kind === 'produce_type') return 'produce'
  return 'reading'
}

export default function WordsLesson({ navigate, progressAPI, level }) {
  const levelMeta = getLevel('words', level)
  const pool = level ? itemsForLevel('words', level) : allWords
  const title = levelMeta ? levelMeta.title : 'All levels'
  const [state, dispatch] = useReducer(reducer, initial)
  const { progress, recordAnswer, recordSkillRound, recordWordResult, recordLevelRound } = progressAPI
  const showingFeedback = state.status === 'feedback'

  function start() {
    const questions = buildSession(progress, pool)
    dispatch({ type: 'boot', questions, pool })
  }

  useEffect(() => {
    start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level])

  function finish(correct, extra = {}) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const nextHistory = [...state.history, correct ? 'c' : 'w']
    const willFinish = state.idx + 1 >= state.questions.length

    dispatch({ type: 'answer', correct, ...extra })
    if (correct) playCorrectSound()
    else playWrongSound()

    recordWordResult(q.word.id, skillFor(q.kind), correct)
    recordAnswer(q.word.id, correct, 'words')

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) {
        const score = nextHistory.filter(h => h === 'c').length
        const pct = Math.round((score / state.questions.length) * 100)
        recordSkillRound('words', pct)
        if (level) recordLevelRound('words', level, pct)
      }
      dispatch({ type: 'next' })
    }, 1000)
  }

  function handlePick(opt) {
    const q = state.questions[state.idx]
    finish(opt.id === q.word.id, { pickedId: opt.id })
  }

  function handleSubmit(e) {
    e?.preventDefault?.()
    if (!state.typed.trim()) return
    const q = state.questions[state.idx]
    finish(matchesGeoOrRoman(state.typed, q.word), { typed: state.typed })
  }

  function typeLetter(ch) {
    if (showingFeedback) return
    dispatch({ type: 'type', value: state.typed + ch })
  }

  if (state.done) {
    const score = state.history.filter(h => h === 'c').length
    const pct = Math.round((score / state.questions.length) * 100)
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '📚'}</div>
          <h2 className="result-title">Words round done</h2>
          <div className="result-score">{score}/{state.questions.length}</div>
          <div className="result-sub">{title} · mixed practice · {pct}%</div>
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
          <span className="nav-title">Words · {title}</span>
        </nav>
        <p style={{ color: 'var(--text3)' }}>Loading…</p>
      </div>
    )
  }

  const q = state.questions[state.idx]
  const w = q.word
  const score = state.history.filter(h => h === 'c').length

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Words · {title}</span>
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

      <div className="practice-prompt" key={`wp-${state.step}`}>
        {q.kind === 'listen_meaning' && (
          <button type="button" className="sound-btn sound-btn-lg" onClick={() => speakWord(w.georgian)}>
            ▶ Listen
          </button>
        )}
        {q.kind === 'read_meaning' && (
          <>
            <div className="q-geo">{w.georgian}</div>
            {q.showRoman && <div className="decode-roman-hint">{w.roman}</div>}
            <button type="button" className="sound-btn" onClick={() => speakWord(w.georgian)}>▶ Listen</button>
          </>
        )}
        {(q.kind === 'produce_pick' || q.kind === 'produce_type') && (
          <>
            <div className="q-geo" style={{ fontFamily: 'inherit', fontSize: '1.75rem' }}>{w.english}</div>
            <button type="button" className="sound-btn" style={{ marginTop: 10 }} onClick={() => speakWord(w.georgian)}>
              ▶ Hear model
            </button>
          </>
        )}
      </div>

      {q.kind === 'produce_type' ? (
        <>
          <div className={`write-display${showingFeedback ? (matchesGeoOrRoman(state.typed, w) ? ' correct' : ' wrong') : ''}`}>
            {state.typed || <span className="write-placeholder">Tap letters…</span>}
          </div>
          {showingFeedback && (
            <div className="recall-answer">Answer: <strong>{w.georgian}</strong> ({w.roman})</div>
          )}
          <div className="geo-keyboard" aria-label="Georgian keyboard">
            {GEO_LETTERS.map(letter => (
              <button
                key={letter}
                type="button"
                className="geo-key"
                disabled={showingFeedback}
                onClick={() => typeLetter(letter)}
              >
                {letter}
              </button>
            ))}
            <button
              type="button"
              className="geo-key geo-key-wide"
              disabled={showingFeedback}
              onClick={() => dispatch({ type: 'type', value: state.typed.slice(0, -1) })}
            >
              ⌫
            </button>
            <button
              type="button"
              className="geo-key geo-key-check"
              disabled={showingFeedback || !state.typed.trim()}
              onClick={handleSubmit}
            >
              Check →
            </button>
          </div>
        </>
      ) : (
        <div className="options-stack" key={`wo-${state.step}`}>
          {state.opts.map(opt => {
            let cls = 'option-row'
            if (showingFeedback) {
              if (opt.id === w.id) cls += ' is-correct'
              else if (opt.id === state.pickedId) cls += ' is-wrong'
            }
            return (
              <button
                key={`${state.step}-${opt.id}`}
                type="button"
                className={cls}
                disabled={showingFeedback}
                onClick={() => handlePick(opt)}
              >
                {q.kind === 'produce_pick' ? (
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
