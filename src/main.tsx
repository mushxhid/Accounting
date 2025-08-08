import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import Login from './components/Login'
import { observeAuth } from './utils/auth'

const Root: React.FC = () => {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    const unsub = observeAuth(u => { setUser(u); setReady(true) })
    return () => unsub()
  }, [])
  if (!ready) return null
  return user ? <App /> : <Login />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)