import { units, unitBest } from '../data/units'
import {
  alphabetReady,
  isLevelUnlocked,
  levelUnlockHint,
  alphabetUnlockHint,
  pathProgressLabel,
} from '../utils/pathUnlock'

export default function Home({ navigate, progress }) {
  const pct = n => Math.round(n * 100) || 0
  const accuracy = progress.totalAttempts > 0
    ? pct(progress.totalCorrect / progress.totalAttempts)
    : 0

  const alphaOpen = true
  const alphaDone = alphabetReady(progress)
  const alphaHint = alphabetUnlockHint(progress)
  const alphaLabel = pathProgressLabel('alphabet', progress)

  return (
    <div className="screen">
      <div className="home-header">
        <div className="home-geo">გამარჯობა!</div>
        <h1 className="home-title">Learn Georgian</h1>
        <p className="home-sub">Alphabet → levels with words & everyday phrases (listen · read · write · talk)</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num">🔥 {progress.streak}</div>
          <div className="stat-label">Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{progress.learnedWords.length}</div>
          <div className="stat-label">Words</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      <div className="path-label">Your learning path</div>
      <div className="module-list">
        {/* Alphabet — block 1 */}
        <div className={`module-wrap${alphaOpen ? '' : ' is-locked'}`}>
          <button
            type="button"
            className={`module-card${alphaOpen ? '' : ' is-locked'}`}
            onClick={() => navigate('alphabet')}
          >
            <div className="module-step">1</div>
            <div className="module-info">
              <div className="module-title">Alphabet</div>
              <div className="module-desc">Recognize & recall Mkhedruli letters</div>
              <div className="module-skill">Letters</div>
              {alphaLabel && <div className="module-progress">{alphaLabel}</div>}
            </div>
            <div className="module-arrow">›</div>
          </button>
          {!alphaDone && alphaHint && (
            <div className="module-tooltip" role="tooltip">
              <div className="module-tooltip-why">Finish Alphabet to unlock Level 1</div>
              <ul className="module-tooltip-list">
                {alphaHint.missing.map(line => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Progressive mixed levels — one unlock at a time */}
        {units.map(unit => {
          const open = isLevelUnlocked(unit.id, progress)
          const best = unitBest(progress, unit.id)
          const lockHint = levelUnlockHint(unit.id, progress)
          const step = unit.id + 1
          return (
            <div key={unit.key} className={`module-wrap${open ? '' : ' is-locked'}`}>
              <button
                type="button"
                className={`module-card${open ? '' : ' is-locked'}`}
                aria-disabled={!open}
                disabled={!open}
                onClick={() => open && navigate('unit', { level: unit.id })}
              >
                <div className={`module-step${open ? '' : ' is-locked'}`}>
                  {open ? step : '🔒'}
                </div>
                <div className="module-info">
                  <div className="module-title">{unit.title}</div>
                  <div className="module-desc">{unit.subtitle} — {unit.grammar}</div>
                  <div className="module-skill">{unit.skill}</div>
                  {open && (
                    <div className="module-progress">
                      {unit.words.length} words · {unit.phrases.length} phrases
                      {best ? ` · best ${best}%` : ''}
                    </div>
                  )}
                  {!open && lockHint && (
                    <div className="level-lock-hint">{lockHint}</div>
                  )}
                </div>
                {open && <div className="module-arrow">›</div>}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
