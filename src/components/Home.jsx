import { useState } from 'react'
import { vocabulary, allWords } from '../data/vocabulary'
import { alphabet } from '../data/alphabet'

export default function Home({ navigate, progress }) {
  const [showVocabMenu, setShowVocabMenu] = useState(false)
  const [showTransMenu, setShowTransMenu] = useState(false)

  const pct = n => Math.round(n * 100) || 0
  const accuracy = progress.totalAttempts > 0
    ? pct(progress.totalCorrect / progress.totalAttempts)
    : 0

  return (
    <div className="screen">
      <div className="home-header">
        <div className="home-geo">გამარჯობა!</div>
        <h1 className="home-title">Learn Georgian</h1>
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

      <div className="module-list">
        <button className="module-card" onClick={() => navigate('alphabet')}>
          <div className="module-icon">
            <span style={{ fontFamily: 'Sylfaen, serif', fontSize: '1.6rem' }}>ა</span>
          </div>
          <div className="module-info">
            <div className="module-title">Learn the alphabet</div>
            <div className="module-desc">Browse and practice the 33 Mkhedruli letters</div>
            {progress.alphabetSeen.length > 0 && (
              <div className="module-progress">
                {progress.alphabetSeen.length}/{alphabet.length} seen
              </div>
            )}
          </div>
          <div className="module-arrow">›</div>
        </button>

        <button className="module-card" onClick={() => setShowVocabMenu(v => !v)}>
          <div className="module-icon">🔤</div>
          <div className="module-info">
            <div className="module-title">Vocabulary</div>
            <div className="module-desc">English → Georgian multiple choice</div>
            {progress.learnedWords.length > 0 && (
              <div className="module-progress">
                {progress.learnedWords.length}/{allWords.length} learned
              </div>
            )}
          </div>
          <div className="module-arrow" style={{ transform: showVocabMenu ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</div>
        </button>

        {showVocabMenu && (
          <div className="category-grid">
            <button className="cat-btn" onClick={() => { setShowVocabMenu(false); navigate('quiz', { category: null }) }}>
              <div className="cat-btn-icon">🌍</div>
              <div className="cat-btn-title">All</div>
              <div className="cat-btn-count">{allWords.length} words</div>
            </button>
            {Object.entries(vocabulary).map(([key, cat]) => (
              <button
                key={key}
                className="cat-btn"
                onClick={() => { setShowVocabMenu(false); navigate('quiz', { category: key }) }}
              >
                <div className="cat-btn-icon">{cat.icon}</div>
                <div className="cat-btn-title">{cat.title}</div>
                <div className="cat-btn-count">{cat.words.length} words</div>
              </button>
            ))}
          </div>
        )}

        <button className="module-card" onClick={() => setShowTransMenu(v => !v)}>
          <div className="module-icon">✍️</div>
          <div className="module-info">
            <div className="module-title">Translation</div>
            <div className="module-desc">Type the Georgian from English</div>
          </div>
          <div className="module-arrow" style={{ transform: showTransMenu ? 'rotate(90deg)' : 'none', transition: '0.2s' }}>›</div>
        </button>

        {showTransMenu && (
          <div className="category-grid">
            <button className="cat-btn" onClick={() => { setShowTransMenu(false); navigate('translation', { category: null }) }}>
              <div className="cat-btn-icon">🌍</div>
              <div className="cat-btn-title">All</div>
              <div className="cat-btn-count">{allWords.length} words</div>
            </button>
            {Object.entries(vocabulary).map(([key, cat]) => (
              <button
                key={key}
                className="cat-btn"
                onClick={() => { setShowTransMenu(false); navigate('translation', { category: key }) }}
              >
                <div className="cat-btn-icon">{cat.icon}</div>
                <div className="cat-btn-title">{cat.title}</div>
                <div className="cat-btn-count">{cat.words.length} words</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
