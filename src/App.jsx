import { useState } from 'react'
import { useProgress } from './hooks/useProgress'
import { learningPath } from './data/vocabulary'
import { isPathUnlocked } from './utils/pathUnlock'
import Home from './components/Home'
import AlphabetLesson from './components/AlphabetLesson'
import SkillLesson from './components/SkillLesson'
import TranslationLesson from './components/TranslationLesson'

function pathIdForView(view) {
  if (view === 'quiz') return 'speak'
  if (view === 'translation') return 'write'
  const item = learningPath.find(p => p.view === view || p.id === view)
  return item?.id || null
}

export default function App() {
  const [screen, setScreen] = useState({ view: 'home' })
  const progressAPI = useProgress()

  const navigate = (view, params = {}) => {
    const pathId = pathIdForView(view)
    if (pathId && !isPathUnlocked(pathId, progressAPI.progress)) {
      setScreen({ view: 'home' })
      return
    }
    setScreen({ view, ...params })
  }

  if (screen.view === 'home')
    return <Home navigate={navigate} progress={progressAPI.progress} />

  if (screen.view === 'alphabet')
    return <AlphabetLesson navigate={navigate} progressAPI={progressAPI} />

  if (screen.view === 'listen')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="listen" />

  if (screen.view === 'read')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="read" />

  if (screen.view === 'speak')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="speak" />

  if (screen.view === 'write')
    return <TranslationLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} />

  // Legacy routes
  if (screen.view === 'quiz')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="speak" />

  if (screen.view === 'translation')
    return <TranslationLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} />

  return <Home navigate={navigate} progress={progressAPI.progress} />
}
