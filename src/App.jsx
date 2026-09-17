import { useState } from 'react'
import { useProgress } from './hooks/useProgress'
import { learningPath } from './data/vocabulary'
import { isPathUnlocked } from './utils/pathUnlock'
import Home from './components/Home'
import AlphabetLesson from './components/AlphabetLesson'
import DecodeLesson from './components/DecodeLesson'
import ListenLesson from './components/ListenLesson'
import WordsLesson from './components/WordsLesson'
import PhrasesLesson from './components/PhrasesLesson'
import SkillLesson from './components/SkillLesson'
import TranslationLesson from './components/TranslationLesson'

function pathIdForView(view) {
  if (view === 'quiz') return 'speak'
  if (view === 'translation') return 'write'
  const item = learningPath.find(p => p.view === view || p.id === view)
  return item?.id || view
}

export default function App() {
  const [screen, setScreen] = useState({ view: 'home' })
  const progressAPI = useProgress()

  const navigate = (view, params = {}) => {
    const pathId = pathIdForView(view)
    if (pathId && pathId !== 'home' && !isPathUnlocked(pathId, progressAPI.progress)) {
      setScreen({ view: 'home' })
      return
    }
    setScreen({ view, ...params })
  }

  if (screen.view === 'home')
    return <Home navigate={navigate} progress={progressAPI.progress} />

  if (screen.view === 'alphabet')
    return <AlphabetLesson navigate={navigate} progressAPI={progressAPI} />

  if (screen.view === 'decode')
    return <DecodeLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  if (screen.view === 'listen')
    return <ListenLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  if (screen.view === 'words')
    return <WordsLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  if (screen.view === 'phrases')
    return <PhrasesLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  if (screen.view === 'write')
    return <TranslationLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  // Legacy routes
  if (screen.view === 'read')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="read" />

  if (screen.view === 'speak' || screen.view === 'quiz')
    return <SkillLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} mode="speak" />

  if (screen.view === 'translation')
    return <TranslationLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  return <Home navigate={navigate} progress={progressAPI.progress} />
}
