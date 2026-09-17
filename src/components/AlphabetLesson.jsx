import { useEffect, useReducer, useRef, useState } from 'react'
import { alphabet } from '../data/alphabet'
import { playCorrectSound, playWrongSound, speakLetter, speakWord } from '../utils/audio'
import {
  countRecognitionReady,
  countRecallReady,
  matchesRoman,
  pickAlphabetSession,
  recognitionOptions,
  reverseOptions,
} from '../utils/srs'

const SESSION_SIZE = 12

const initial = {
  active: false,
  done: false,
  status: 'prompt',
  questions: [],
  idx: 0,
  opts: [],
  picked: null,
  typed: '',
  score: { c: 0, w: 0 },
  step: 0,
}

function optsFor(q) {
  if (!q) return []
  if (q.kind === 'recognize') return recognitionOptions(q.letter, alphabet)
  if (q.kind === 'reverse') return reverseOptions(q.letter, alphabet)
  return []
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
        opts: optsFor(questions[0]),
        picked: null,
        typed: '',
        score: { c: 0, w: 0 },
        step: 1,
      }
    }
    case 'answer': {
      if (state.status !== 'prompt' || state.done) return state
      return {
        ...state,
        status: 'feedback',
        picked: action.picked,
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
        return { ...state, done: true, status: 'prompt', picked: null, typed: '' }
      }
      return {
        ...state,
        done: false,
        status: 'prompt',
        idx: next,
        opts: optsFor(state.questions[next]),
        picked: null,
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

function PracticeExampleReveal({ example, exMeaning }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button type="button" className="sound-btn" onClick={() => setOpen(true)}>
        See example
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className="sound-btn"
        onClick={() => speakWord(example)}
        aria-label="Listen to an example word"
      >
        ▶ Listen
      </button>
      <div className="practice-example">
        <div className="practice-example-geo">{example}</div>
        <div className="practice-example-en">{exMeaning}</div>
      </div>
    </>
  )
}

function kindLabel(kind) {
  if (kind === 'recall') return 'What sound is this? (type it)'
  if (kind === 'reverse') return 'Which letter makes this sound?'
  return 'What sound is this?'
}

export default function AlphabetLesson({ navigate, progressAPI }) {
  const [tab, setTab] = useState('browse')
  const [selected, setSelected] = useState(null)
  const [state, dispatch] = useReducer(reducer, initial)
  const detailRef = useRef(null)
  const inputRef = useRef(null)

  const {
    progress,
    recordAlphabetSeen,
    recordAlphabetQuiz,
    recordLetterResult,
  } = progressAPI
  const total = state.questions.length || SESSION_SIZE
  const showingFeedback = state.status === 'feedback'
  const recognized = countRecognitionReady(progress)
  const recalled = countRecallReady(progress)

  useEffect(() => {
    if (!selected) return
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected])

  useEffect(() => {
    if (tab !== 'practice' || !state.active) return
    const q = state.questions[state.idx]
    if (q?.kind === 'recall' && state.status === 'prompt') {
      inputRef.current?.focus()
    }
  }, [tab, state.active, state.idx, state.status, state.questions])

  // Autoplay the letter sound — recognition/recall hear პ; reverse hears the cue
  useEffect(() => {
    if (tab !== 'practice' || !state.active || state.status !== 'prompt') return
    const q = state.questions[state.idx]
    if (!q?.letter?.letter) return
    speakLetter(q.letter.letter)
  }, [tab, state.active, state.status, state.idx, state.step, state.questions])

  function startPractice() {
    const questions = pickAlphabetSession(progress, SESSION_SIZE)
    dispatch({ type: 'boot', questions })
    setTab('practice')
  }

  function handleSelect(letter) {
    setSelected(selected?.letter === letter.letter ? null : letter)
    recordAlphabetSeen(letter.letter)
  }

  function finishItem(correct, { picked = null, typed = '', confusedWith = null } = {}) {
    if (state.status !== 'prompt' || state.done) return
    const q = state.questions[state.idx]
    const skill = q.kind === 'recall' ? 'recall' : 'recognition'
    const finalCorrect = state.score.c + (correct ? 1 : 0)
    const willFinish = state.idx + 1 >= total

    dispatch({ type: 'answer', correct, picked, typed })
    recordLetterResult(q.letter.letter, skill, correct, confusedWith)
    if (correct) playCorrectSound()
    else playWrongSound()

    window.setTimeout(() => {
      document.activeElement?.blur?.()
      if (willFinish) recordAlphabetQuiz(finalCorrect)
      dispatch({ type: 'next' })
    }, 900)
  }

  function handlePick(opt) {
    const q = state.questions[state.idx]
    if (q.kind === 'recognize') {
      const correct = opt.roman === q.letter.roman
      finishItem(correct, {
        picked: opt.roman,
        confusedWith: correct ? null : opt.letter,
      })
      return
    }
    if (q.kind === 'reverse') {
      const correct = opt.letter === q.letter.letter
      finishItem(correct, {
        picked: opt.letter,
        confusedWith: correct ? null : opt.letter,
      })
    }
  }

  function handleRecallSubmit(e) {
    e?.preventDefault?.()
    if (state.status !== 'prompt') return
    const q = state.questions[state.idx]
    const typed = state.typed
    if (!typed.trim()) return
    const correct = matchesRoman(typed, q.letter)
    finishItem(correct, { typed })
  }

  if (tab === 'practice' && state.done) {
    return (
      <div className="screen">
        <div className="result-screen">
          <div className="result-emoji">{state.score.c >= total * 0.8 ? '🏆' : '📚'}</div>
          <h2 className="result-title">Complete!</h2>
          <div className="result-score">{state.score.c}/{total}</div>
          <div className="result-sub">
            {state.score.c >= total * 0.9 ? 'Excellent — letters are sticking.'
              : state.score.c >= total * 0.7 ? 'Nice work. Keep practicing weak letters.'
              : 'Review again — focus on letters you missed.'}
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
    const letter = q.letter

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

        <div className="quiz-score" style={{ marginBottom: 16 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text3)', marginRight: 4 }}>
            {state.idx + 1}/{total}
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>✓ {state.score.c}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginLeft: 8 }}>✗ {state.score.w}</span>
        </div>

        <p className="practice-kind">{kindLabel(q.kind)}</p>

        <div className="practice-prompt" key={`q-${state.step}`}>
          {q.kind === 'reverse' ? (
            <button
              type="button"
              className="sound-btn sound-btn-lg"
              onClick={() => speakLetter(letter.letter)}
              aria-label="Hear the sound"
            >
              ▶ Hear the sound
            </button>
          ) : (
            <>
              <div className="practice-letter">{letter.letter}</div>
              <button
                type="button"
                className="sound-btn"
                onClick={() => speakLetter(letter.letter)}
                aria-label="Hear this letter"
              >
                ▶ Listen
              </button>
              <PracticeExampleReveal example={letter.example} exMeaning={letter.exMeaning} />
            </>
          )}
        </div>

        {q.kind === 'recall' ? (
          <form className="recall-form" onSubmit={handleRecallSubmit} key={`recall-${state.step}`}>
            <input
              ref={inputRef}
              className={`trans-input${showingFeedback ? (matchesRoman(state.typed, letter) ? ' correct' : ' wrong') : ''}`}
              value={state.typed}
              onChange={e => dispatch({ type: 'type', value: e.target.value })}
              placeholder="e.g. a, k', sh…"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={showingFeedback}
              aria-label="Sound / romanization"
            />
            {showingFeedback && (
              <div className="recall-answer">
                Answer: <strong>{letter.ipa}</strong>
                <span className="recall-answer-roman"> ({letter.roman})</span>
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
          <div className="options-stack" key={`opts-${state.step}`}>
            {state.opts.map(opt => {
              let cls = 'option-row'
              if (showingFeedback) {
                if (q.kind === 'recognize') {
                  if (opt.roman === letter.roman) cls += ' is-correct'
                  else if (opt.roman === state.picked) cls += ' is-wrong'
                } else {
                  if (opt.letter === letter.letter) cls += ' is-correct'
                  else if (opt.letter === state.picked) cls += ' is-wrong'
                }
              }
              return (
                <button
                  key={`${state.step}-${opt.letter}`}
                  type="button"
                  className={cls}
                  onClick={() => handlePick(opt)}
                  disabled={showingFeedback}
                >
                  {q.kind === 'reverse' ? (
                    <span className="option-geo">{opt.letter}</span>
                  ) : (
                    <>
                      <span className="option-ipa">{opt.ipa}</span>
                      <span className="option-meta">{opt.roman}</span>
                    </>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="screen">
      <nav className="nav">
        <button type="button" className="nav-back" onClick={() => navigate('home')}>‹</button>
        <span className="nav-title">Alphabet</span>
        <button type="button" className="nav-action" onClick={startPractice}>
          Practice
        </button>
      </nav>

      <p style={{ color: 'var(--text3)', fontSize: '0.8125rem', marginBottom: 10, lineHeight: 1.4 }}>
        Tap a letter to study it. Practice starts with Georgian → sound; sound → Georgian unlocks after solid recognition.
      </p>

      <div className="alpha-mastery">
        <span>{recognized}/{alphabet.length} recognized</span>
        <span>{recalled}/{alphabet.length} recall</span>
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
        <div className="letter-detail" ref={detailRef}>
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
            onClick={() => speakLetter(selected.letter)}
          >
            ▶ Letter sound
          </button>
          <button
            type="button"
            className="sound-btn"
            style={{ margin: '8px auto 0', display: 'flex' }}
            onClick={() => speakWord(selected.example)}
          >
            ▶ Example word
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
