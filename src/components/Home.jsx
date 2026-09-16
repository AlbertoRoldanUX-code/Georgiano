import { useState } from 'react'
import { learningPath } from '../data/vocabulary'
import {
  levelsForSkill,
  isSkillLevelUnlocked,
  skillLevelUnlockHint,
  LEVEL_BEST_KEYS,
} from '../data/levels'
import { isPathUnlocked, unlockHint, pathProgressLabel } from '../utils/pathUnlock'

const LEVELED = new Set(['listen', 'words', 'phrases', 'write'])
const DIRECT = new Set(['alphabet', 'decode'])

export default function Home({ navigate, progress }) {
  const [openSkill, setOpenSkill] = useState(null)

  const pct = n => Math.round(n * 100) || 0
  const accuracy = progress.totalAttempts > 0
    ? pct(progress.totalCorrect / progress.totalAttempts)
    : 0

  function toggleSkill(id) {
    setOpenSkill(s => (s === id ? null : id))
  }

  function goLevel(view, levelId) {
    setOpenSkill(null)
    navigate(view, { level: levelId })
  }

  function bestFor(skill, levelId) {
    const key = LEVEL_BEST_KEYS[skill]
    const map = progress[key] || {}
    return map[String(levelId)] ?? map[levelId]
  }

  function itemCount(lv) {
    if (lv.phrases) return `${lv.phrases.length} phrases`
    return `${lv.words.length} words`
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
          const skill = item.id
          const leveled = LEVELED.has(item.view)
          const unlocked = isPathUnlocked(item.id, progress)
          const isOpen = unlocked && openSkill === item.id
          const hint = unlockHint(item.id, progress)
          const label = pathProgressLabel(item.id, progress)
          const levels = leveled ? levelsForSkill(skill) : []

          return (
            <div key={item.id} className={`module-wrap${unlocked ? '' : ' is-locked'}`}>
              <button
                type="button"
                className={`module-card${unlocked ? '' : ' is-locked'}`}
                aria-disabled={!unlocked}
                onClick={() => {
                  if (!unlocked) return
                  if (DIRECT.has(item.view)) navigate(item.view)
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
                    transform: leveled && isOpen ? 'rotate(90deg)' : 'none',
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

              {leveled && isOpen && (
                <div className="level-list">
                  {levels.map(lv => {
                    const open = isSkillLevelUnlocked(skill, lv.id, progress)
                    const best = bestFor(skill, lv.id)
                    const lockHint = skillLevelUnlockHint(skill, lv.id, progress)
                    return (
                      <button
                        key={lv.key}
                        type="button"
                        className={`level-btn${open ? '' : ' is-locked'}`}
                        disabled={!open}
                        title={lockHint || undefined}
                        onClick={() => open && goLevel(item.view, lv.id)}
                      >
                        <div className={`level-badge${open ? '' : ' is-locked'}`}>
                          {open ? lv.icon : '🔒'}
                        </div>
                        <div className="level-info">
                          <div className="level-title">{lv.title}</div>
                          <div className="level-sub">{lv.subtitle}</div>
                          <div className="level-count">
                            {itemCount(lv)}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
