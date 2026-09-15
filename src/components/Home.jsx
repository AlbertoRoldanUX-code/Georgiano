import { useState } from 'react'
import { vocabulary, allWords, learningPath } from '../data/vocabulary'
import { alphabet } from '../data/alphabet'

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

  return (
    <div className="screen">
      <div className="home-header">
        <div className="home-geo">გამარჯობა!</div>
        <h1 className="home-title">Learn Georgian</h1>
        <p className="home-sub">Follow the path: sounds → words → produce</p>
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
          const needsCategory = item.view !== 'alphabet'
          const isOpen = openSkill === item.id

          return (
            <div key={item.id}>
              <button
                type="button"
                className="module-card"
                onClick={() => {
                  if (item.view === 'alphabet') navigate('alphabet')
                  else toggleSkill(item.id)
                }}
              >
                <div className="module-step">{item.step}</div>
                <div className="module-info">
                  <div className="module-title">{item.title}</div>
                  <div className="module-desc">{item.desc}</div>
                  <div className="module-skill">{item.skill}</div>
                  {item.view === 'alphabet' && progress.alphabetSeen.length > 0 && (
                    <div className="module-progress">
                      {progress.alphabetSeen.length}/{alphabet.length} letters seen
                    </div>
                  )}
                </div>
                <div
                  className="module-arrow"
                  style={{
                    transform: needsCategory && isOpen ? 'rotate(90deg)' : 'none',
                    transition: '0.2s',
                  }}
                >
                  ›
                </div>
              </button>

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
