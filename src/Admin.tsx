import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'

interface Claim {
  id: string
  timestamp: string
  statement: string
  speaker: string
  status: string
  category: string
  explanation?: string
  stage?: string
}

interface User {
  username: string
  authenticated: boolean
}

const CATEGORIES = ['economy', 'healthcare', 'immigration', 'foreign-policy', 'climate', 'other']
const API_URL = import.meta.env.VITE_API_URL || (window.location.origin)

export default function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [claims, setClaims] = useState<Claim[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    statement: '',
    speaker: 'President',
    category: 'economy'
  })

  const token = searchParams.get('token')
  const urlError = searchParams.get('error')
  const urlUser = searchParams.get('user')

  // Handle OAuth callback
  useEffect(() => {
    if (urlError === 'unauthorized' && urlUser) {
      setError(`User "${urlUser}" is not authorized to access the admin panel.`)
      // Clear URL params
      setSearchParams({}, { replace: true })
    }
    
    if (token) {
      // Store token and clear URL
      localStorage.setItem('admin_token', token)
      setSearchParams({}, { replace: true })
    }
  }, [token, urlError, urlUser, setSearchParams])

  // Verify token on mount
  useEffect(() => {
    const storedToken = localStorage.getItem('admin_token')
    if (!storedToken) {
      setIsLoading(false)
      return
    }

    // Verify token with backend
    fetch(`${API_URL}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${storedToken}`
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Invalid token')
      return res.json()
    })
    .then(data => {
      setUser(data)
      setIsLoading(false)
    })
    .catch(() => {
      localStorage.removeItem('admin_token')
      setIsLoading(false)
    })
  }, [token]) // Re-run if token was just set

  // WebSocket connection
  useEffect(() => {
    if (!user) return

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'init') {
        setClaims(data.data)
      } else if (data.type === 'new_claim') {
        setClaims(prev => [data.claim, ...prev])
      } else if (data.type === 'claim_complete') {
        setClaims(prev => prev.map(c => c.id === data.claim.id ? data.claim : c))
      }
    }
    
    return () => ws.close()
  }, [user])

  const handleLogin = () => {
    window.location.href = `${API_URL}/api/auth/github`
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setUser(null)
    setClaims([])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('admin_token')
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'claim',
        token,
        ...form
      }))
      ws.close()
      setForm({ statement: '', speaker: 'President', category: 'economy' })
    }
  }

  // Login Screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">🔒 Admin Access</h1>
            <p className="text-slate-600">Facts of the Union Administration Panel</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-slate-900 text-white py-3 px-6 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
              </svg>
              Continue with GitHub
            </button>

            <div className="text-center">
              <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">
                ← Back to main site
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200 text-xs text-slate-400 text-center">
            Only authorized GitHub users can access this panel.
          </div>
        </motion.div>
      </div>
    )
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-slate-400 hover:text-white">
                ← Back to Feed
              </Link>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
                <span className="text-sm text-slate-300">@{user.username}</span>
                <button
                  onClick={handleLogout}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inject Claim Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold mb-4">🚀 Inject Claim</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Statement</label>
              <textarea
                value={form.statement}
                onChange={e => setForm({...form, statement: e.target.value})}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the claim to fact-check..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Speaker</label>
                <input
                  type="text"
                  value={form.speaker}
                  onChange={e => setForm({...form, speaker: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({...form, category: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-bold"
            >
              🚀 Send to Analysis Engine
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-bold text-blue-900 mb-2">⚡ Quick Test Claims</h3>
            <div className="space-y-2">
              {[
                "We created 15 million jobs - the best economy ever!",
                "Inflation dropped from 9% to 2.9%",
                "We secured the border more than any previous administration"
              ].map((claim, i) => (
                <button
                  key={i}
                  onClick={() => setForm({...form, statement: claim})}
                  className="block w-full text-left text-sm text-blue-700 hover:bg-blue-100 p-2 rounded"
                >
                  "{claim.substring(0, 50)}..."
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Claims Monitor */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-bold mb-4">📡 Live Claims ({claims.length})</h2>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {claims.map((claim) => (
              <motion.div 
                key={claim.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`border rounded-lg p-4 ${
                  claim.status === 'yellow' ? 'border-yellow-400 bg-yellow-50' :
                  claim.status === 'true' ? 'border-green-400 bg-green-50' :
                  claim.status === 'false' ? 'border-red-400 bg-red-50' :
                  'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-slate-500">{claim.timestamp}</p>
                    <p className="font-medium mt-1 line-clamp-2">"{claim.statement}"</p>
                    {claim.stage && (
                      <p className="text-xs text-blue-600 mt-1">🔍 {claim.stage}</p>
                    )}
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    claim.status === 'true' ? 'bg-green-200 text-green-800' :
                    claim.status === 'false' ? 'bg-red-200 text-red-800' :
                    claim.status === 'yellow' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {claim.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
