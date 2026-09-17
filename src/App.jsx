import { useState } from 'react'
import { useProgress } from './hooks/useProgress'
import { isPathUnlocked, isLevelUnlocked } from './utils/pathUnlock'
import Home from './components/Home'
import AlphabetLesson from './components/AlphabetLesson'
import UnitLesson from './components/UnitLesson'

export default function App() {
  const [screen, setScreen] = useState({ view: 'home' })
  const progressAPI = useProgress()

  const navigate = (view, params = {}) => {
    if (view === 'home') {
      setScreen({ view: 'home' })
      return
    }

    if (view === 'alphabet') {
      setScreen({ view: 'alphabet' })
      return
    }

    if (view === 'unit') {
      const level = Number(params.level) || 1
      if (!isLevelUnlocked(level, progressAPI.progress)) {
        setScreen({ view: 'home' })
        return
      }
      setScreen({ view: 'unit', level })
      return
    }

    // Legacy skill routes → redirect into the linear unit path
    if (['decode', 'listen', 'words', 'phrases', 'write', 'read', 'speak', 'quiz', 'translation'].includes(view)) {
      if (!isPathUnlocked('unit', progressAPI.progress)) {
        setScreen({ view: 'home' })
        return
      }
      setScreen({ view: 'unit', level: Number(params.level) || 1 })
      return
    }

    setScreen({ view: 'home' })
  }

  if (screen.view === 'home')
    return <Home navigate={navigate} progress={progressAPI.progress} />

  if (screen.view === 'alphabet')
    return <AlphabetLesson navigate={navigate} progressAPI={progressAPI} />

  if (screen.view === 'unit')
    return <UnitLesson navigate={navigate} progressAPI={progressAPI} level={screen.level} />

  return <Home navigate={navigate} progress={progressAPI.progress} />
}
