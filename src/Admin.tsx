import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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

const CATEGORIES = ['economy', 'healthcare', 'immigration', 'foreign-policy', 'climate', 'other']

export default function AdminPanel() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [form, setForm] = useState({
    statement: '',
    speaker: 'President',
    category: 'economy'
  })

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => setIsConnected(true)
    ws.onclose = () => setIsConnected(false)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'init') {
        setClaims(data.claims)
      } else if (data.type === 'new_claim') {
        setClaims(prev => [data.claim, ...prev])
      } else if (data.type === 'claim_complete') {
        setClaims(prev => prev.map(c => c.id === data.claim.id ? data.claim : c))
      }
    }
    
    return () => ws.close()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'claim',
        ...form
      }))
      ws.close()
      setForm({ statement: '', speaker: 'President', category: 'economy' })
    }
  }

  const updateStatus = (claimId: string, status: string) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
    fetch(`${apiUrl}/api/claims`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: claimId, status })
    })
  }

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
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
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

                {/* Quick Status Override */}
                <div className="flex gap-1 mt-3">
                  {['true', 'yellow', 'false', 'analyzing'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateStatus(claim.id, status)}
                      className="text-xs px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded"
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
