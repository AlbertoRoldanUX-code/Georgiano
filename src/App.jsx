import { useState } from 'react'
import { useProgress } from './hooks/useProgress'
import Home from './components/Home'
import AlphabetLesson from './components/AlphabetLesson'
import QuizLesson from './components/QuizLesson'
import TranslationLesson from './components/TranslationLesson'

export default function App() {
  const [screen, setScreen] = useState({ view: 'home' })
  const progressAPI = useProgress()

  const navigate = (view, params = {}) => setScreen({ view, ...params })

  if (screen.view === 'home')
    return <Home navigate={navigate} progress={progressAPI.progress} />

  if (screen.view === 'alphabet')
    return <AlphabetLesson navigate={navigate} progressAPI={progressAPI} />

  if (screen.view === 'quiz')
    return <QuizLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} />

  if (screen.view === 'translation')
    return <TranslationLesson navigate={navigate} progressAPI={progressAPI} category={screen.category} />

  return <Home navigate={navigate} progress={progressAPI.progress} />
}
