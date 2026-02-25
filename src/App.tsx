import { useState, useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './index.css'
import AdminPanel from './Admin'

interface Claim {
  id: string
  timestamp: string
  statement: string
  speaker: string
  status: 'analyzing' | 'true' | 'yellow' | 'false' | 'pending'
  category: string
  explanation?: string
  neutral_rephrase?: string
  sources: string[]
  stage?: string
}

const STATUS_COLORS = {
  'true': 'bg-green-500',
  'yellow': 'bg-yellow-500',
  'false': 'bg-red-500',
  'analyzing': 'bg-blue-400 animate-pulse',
  'pending': 'bg-gray-400'
}

const STATUS_LABELS = {
  'true': '✅ True',
  'yellow': '⚠️ Clarified',
  'false': '❌ False',
  'analyzing': '🔍 Analyzing...',
  'pending': '⏳ Pending'
}

const CATEGORY_ICONS: Record<string, string> = {
  'economy': '💰',
  'healthcare': '🏥',
  'immigration': '🌎',
  'foreign-policy': '🕊️',
  'climate': '🌱',
  'other': '📋'
}

function MainApp() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [stats, setStats] = useState({ correct: 0, clarified: 0, falsehoods: 0 })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isConnected, setIsConnected] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [liveTranscript, setLiveTranscript] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = import.meta.env.VITE_WS_URL || `${wsProtocol}//${window.location.host}/ws`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      switch (data.type) {
        case 'init':
          setClaims(data.data || [])
          setStats(data.stats)
          break
        case 'new_claim':
          setClaims(prev => [data.claim, ...prev])
          break
        case 'claim_update':
          setClaims(prev => prev.map(c => 
            c.id === data.claim_id ? { ...c, stage: data.update.stage } : c
          ))
          break
        case 'claim_complete':
          setClaims(prev => prev.map(c => 
            c.id === data.claim.id ? data.claim : c
          ))
          setStats(data.stats)
          break
        case 'transcript':
          setLiveTranscript(data.text)
          break
      }
    }

    return () => ws.close()
  }, [])

  const filteredClaims = selectedCategory === 'all' 
    ? claims 
    : claims.filter(c => c.category === selectedCategory)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Facts of the Union</h1>
              <p className="text-blue-200 mt-1">Real-Time SOTU Fact Checker</p>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/admin" className="text-blue-200 hover:text-white text-sm underline">
                Admin
              </Link>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end">
                  <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                  <span className="font-semibold">{isConnected ? 'LIVE' : 'OFFLINE'}</span>
                </div>
                <p className="text-sm text-blue-200">{currentTime.toLocaleTimeString()}</p>
              </div>
            </div>
          </div>

          {/* Scoreboard */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <motion.p
                key={stats.correct}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-green-400"
              >{stats.correct}</motion.p>
              <p className="text-sm text-blue-100">✅ Correct</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <motion.p
                key={stats.clarified}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-yellow-400"
              >{stats.clarified}</motion.p>
              <p className="text-sm text-blue-100">⚠️ Clarified</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <motion.p
                key={stats.falsehoods}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
                className="text-2xl font-bold text-red-400"
              >{stats.falsehoods}</motion.p>
              <p className="text-sm text-blue-100">❌ False</p>
            </div>
          </div>
        </div>
      </header>

      {/* Live Transcript Bar */}
      {liveTranscript && (
        <div className="bg-blue-900/90 text-white py-2 px-4 border-b border-blue-700">
          <div className="max-w-6xl mx-auto">
            <span className="text-blue-300 text-sm font-mono">LIVE TRANSCRIPT:</span>
            <span className="ml-2 text-sm">{liveTranscript}</span>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-[140px] z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Claims ({claims.length})
            </button>
            {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {icon} {cat.replace('-', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {filteredClaims.map((claim, index) => (
              <motion.article
                key={claim.id}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden hover:shadow-lg transition-shadow ${
                  claim.status === 'yellow' ? 'border-yellow-400 ring-2 ring-yellow-100' :
                  claim.status === 'true' ? 'border-green-400 ring-2 ring-green-100' :
                  claim.status === 'false' ? 'border-red-400 ring-2 ring-red-100' :
                  'border-slate-200'
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                        <span className="font-mono bg-slate-100 px-2 py-1 rounded">{claim.timestamp}</span>
                        <span>•</span>
                        <span className="font-medium">{claim.speaker}</span>
                        <span>•</span>
                        <span>{CATEGORY_ICONS[claim.category] || '📋'} {claim.category?.replace('-', ' ')}</span>
                        {claim.stage && claim.status === 'analyzing' && (
                          <span className="text-blue-500 animate-pulse">• {claim.stage}</span>
                        )}
                      </div>
                      
                      <blockquote className="text-lg font-medium text-slate-900 mb-4 border-l-4 border-blue-500 pl-4">
                        "{claim.statement}"
                      </blockquote>

                      {claim.status !== 'analyzing' && claim.status !== 'pending' && (
                        <>
                          <div className={`rounded-lg p-4 mb-4 ${
                            claim.status === 'yellow' ? 'bg-yellow-50 border border-yellow-200' :
                            claim.status === 'true' ? 'bg-green-50 border border-green-200' :
                            claim.status === 'false' ? 'bg-red-50 border border-red-200' :
                            'bg-slate-50'
                          }`}>
                            <p className={`font-medium mb-2 ${
                              claim.status === 'yellow' ? 'text-yellow-800' :
                              claim.status === 'true' ? 'text-green-800' :
                              claim.status === 'false' ? 'text-red-800' :
                              'text-slate-700'
                            }`}>
                              {STATUS_LABELS[claim.status]}
                            </p>
                            <p className="text-slate-700 leading-relaxed">{claim.explanation}</p>
                            
                            {claim.neutral_rephrase && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-sm text-slate-500 mb-1">🔄 Neutral Rephrase:</p>
                                <p className="text-slate-800 italic">"{claim.neutral_rephrase}"</p>
                              </div>
                            )}
                          </div>

                          {claim.sources?.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center">
                              <span className="text-sm text-slate-500">📚 Sources:</span>
                              {claim.sources.map((source, idx) => (
                                <span key={idx} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                  {source}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-col items-center gap-2">
                      <motion.div 
                        className={`w-16 h-16 ${STATUS_COLORS[claim.status]} rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-lg`}
                        animate={claim.status === 'analyzing' ? { rotate: 360 } : {}}
                        transition={claim.status === 'analyzing' ? { duration: 2, repeat: Infinity, ease: 'linear' } : {}}
                      >
                        {claim.status === 'analyzing' ? '🔍' : 
                         claim.status === 'true' ? '✓' :
                         claim.status === 'false' ? '✗' :
                         claim.status === 'yellow' ? '!' : '?'}
                      </motion.div>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        claim.status === 'analyzing' ? 'bg-blue-100 text-blue-700' :
                        claim.status === 'true' ? 'bg-green-100 text-green-700' :
                        claim.status === 'false' ? 'bg-red-100 text-red-700' :
                        claim.status === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {STATUS_LABELS[claim.status]}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.article>
            ))}

            {filteredClaims.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className="text-slate-500 text-lg">No claims yet. Waiting for SOTU to begin...</p>
                <p className="text-slate-400 mt-2">Claims will appear here in real-time.</p>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      </main>

    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
