import { useState } from 'react'
import { vocabulary, allWords, learningPath } from '../data/vocabulary'
import {
  listenLevels,
  isListenLevelUnlocked,
  listenLevelUnlockHint,
} from '../data/levels'
import { isPathUnlocked, unlockHint, pathProgressLabel } from '../utils/pathUnlock'

const NO_CATEGORY = new Set(['alphabet', 'decode', 'phrases'])

export default function Home({ navigate, progress }) {
  const [openSkill, setOpenSkill] = useState(null)

  const pct = n => Math.round(n * 100) || 0
  const accuracy = progress.totalAttempts > 0
    ? pct(progress.totalCorrect / progress.totalAttempts)
    : 0

  function toggleSkill(id) {
    setOpenSkill(s => (s === id ? null : id))
  }

  function goSkill(view, category = null) {
    setOpenSkill(null)
    navigate(view, { category })
  }

  function goListenLevel(levelId) {
    setOpenSkill(null)
    navigate('listen', { level: levelId })
  }

  return (
    <div className="screen">
      <div className="home-header">
        <div className="home-geo">გამარჯობა!</div>
        <h1 className="home-title">Learn Georgian</h1>
        <p className="home-sub">Alphabet → decode → listen → words → phrases</p>
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
        {learningPath.map(item => {
          const isListen = item.view === 'listen'
          const needsCategory = !NO_CATEGORY.has(item.view) && !isListen
          const unlocked = isPathUnlocked(item.id, progress)
          const isOpen = unlocked && openSkill === item.id
          const hint = unlockHint(item.id, progress)
          const label = pathProgressLabel(item.id, progress)

          return (
            <div key={item.id} className={`module-wrap${unlocked ? '' : ' is-locked'}`}>
              <button
                type="button"
                className={`module-card${unlocked ? '' : ' is-locked'}`}
                aria-disabled={!unlocked}
                onClick={() => {
                  if (!unlocked) return
                  if (NO_CATEGORY.has(item.view)) navigate(item.view)
                  else toggleSkill(item.id)
                }}
              >
                <div className={`module-step${unlocked ? '' : ' is-locked'}`}>
                  {unlocked ? item.step : '🔒'}
                </div>
                <div className="module-info">
                  <div className="module-title">{item.title}</div>
                  <div className="module-desc">{item.desc}</div>
                  <div className="module-skill">{item.skill}</div>
                  {unlocked && label && (
                    <div className="module-progress">{label}</div>
                  )}
                </div>
                <div
                  className="module-arrow"
                  style={{
                    transform: (needsCategory || isListen) && isOpen ? 'rotate(90deg)' : 'none',
                    transition: '0.2s',
                  }}
                >
                  {unlocked ? '›' : ''}
                </div>
              </button>

              {!unlocked && hint && (
                <div className="module-tooltip" role="tooltip">
                  <div className="module-tooltip-why">{hint.why}</div>
                  <ul className="module-tooltip-list">
                    {hint.missing.map(line => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              {isListen && isOpen && (
                <div className="level-list">
                  {listenLevels.map(lv => {
                    const open = isListenLevelUnlocked(lv.id, progress)
                    const best = progress.listenLevelBest?.[String(lv.id)]
                    const lockHint = listenLevelUnlockHint(lv.id, progress)
                    return (
                      <button
                        key={lv.key}
                        type="button"
                        className={`level-btn${open ? '' : ' is-locked'}`}
                        disabled={!open}
                        title={lockHint || undefined}
                        onClick={() => open && goListenLevel(lv.id)}
                      >
                        <div className={`level-badge${open ? '' : ' is-locked'}`}>
                          {open ? lv.icon : '🔒'}
                        </div>
                        <div className="level-info">
                          <div className="level-title">{lv.title}</div>
                          <div className="level-sub">{lv.subtitle}</div>
                          <div className="level-count">
                            {lv.words.length} words
                            {best != null ? ` · best ${best}%` : ''}
                          </div>
                          {!open && lockHint && (
                            <div className="level-lock-hint">{lockHint}</div>
                          )}
                        </div>
                        {open && <div className="module-arrow">›</div>}
                      </button>
                    )
                  })}
                </div>
              )}

              {needsCategory && isOpen && (
                <div className="category-grid">
                  <button type="button" className="cat-btn" onClick={() => goSkill(item.view, null)}>
                    <div className="cat-btn-icon">🌍</div>
                    <div className="cat-btn-title">All</div>
                    <div className="cat-btn-count">{allWords.length} words</div>
                  </button>
                  {Object.entries(vocabulary).map(([key, cat]) => (
                    <button
                      key={key}
                      type="button"
                      className="cat-btn"
                      onClick={() => goSkill(item.view, key)}
                    >
                      <div className="cat-btn-icon">{cat.icon}</div>
                      <div className="cat-btn-title">{cat.title}</div>
                      <div className="cat-btn-count">{cat.words.length} words</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
