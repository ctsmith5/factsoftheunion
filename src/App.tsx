import { useState, useEffect } from 'react'
import './index.css'

interface FactCheck {
  id: string
  timestamp: string
  statement: string
  speaker: string
  category: 'economy' | 'healthcare' | 'immigration' | 'foreign-policy' | 'climate' | 'other'
  status: 'true' | 'mostly-true' | 'half-true' | 'mostly-false' | 'false' | 'pending'
  explanation: string
  sources: string[]
}

const SAMPLE_FACT_CHECKS: FactCheck[] = [
  {
    id: '1',
    timestamp: '21:05',
    speaker: 'President',
    statement: 'Our economy has created over 15 million jobs since I took office.',
    category: 'economy',
    status: 'mostly-true',
    explanation: 'According to Bureau of Labor Statistics data, approximately 14.8 million jobs have been created during this administration. The figure is roughly accurate but slightly rounded up.',
    sources: ['Bureau of Labor Statistics', 'FactCheck.org']
  },
  {
    id: '2', 
    timestamp: '21:12',
    speaker: 'President',
    statement: 'Inflation has dropped from 9% to under 3%.',
    category: 'economy',
    status: 'true',
    explanation: 'The CPI inflation rate peaked at 9.1% in June 2022 and was most recently at 2.9% in January 2025.',
    sources: ['Bureau of Labor Statistics - CPI Data']
  },
  {
    id: '3',
    timestamp: '21:18',
    speaker: 'President', 
    statement: 'We have secured the border more than any previous administration.',
    category: 'immigration',
    status: 'pending',
    explanation: 'Fact-check in progress...',
    sources: []
  }
]

const STATUS_COLORS = {
  'true': 'bg-green-500',
  'mostly-true': 'bg-green-400',
  'half-true': 'bg-yellow-400',
  'mostly-false': 'bg-orange-400',
  'false': 'bg-red-500',
  'pending': 'bg-gray-400'
}

const STATUS_LABELS = {
  'true': 'True',
  'mostly-true': 'Mostly True',
  'half-true': 'Half True',
  'mostly-false': 'Mostly False',
  'false': 'False',
  'pending': 'Checking...'
}

const CATEGORY_ICONS = {
  'economy': '💰',
  'healthcare': '🏥',
  'immigration': '🌎',
  'foreign-policy': '🕊️',
  'climate': '🌱',
  'other': '📋'
}

function App() {
  const [factChecks, setFactChecks] = useState<FactCheck[]>(SAMPLE_FACT_CHECKS)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isLive, setIsLive] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredChecks = selectedCategory === 'all' 
    ? factChecks 
    : factChecks.filter(check => check.category === selectedCategory)

  const trueCount = factChecks.filter(c => c.status === 'true' || c.status === 'mostly-true').length
  const falseCount = factChecks.filter(c => c.status === 'false' || c.status === 'mostly-false').length
  const pendingCount = factChecks.filter(c => c.status === 'pending').length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary-900 via-primary-700 to-primary-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Facts of the Union</h1>
              <p className="text-primary-100 mt-1">Real-Time Fact Checker</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className={`w-3 h-3 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></span>
                <span className="font-semibold">{isLive ? 'LIVE' : 'PAUSED'}</span>
              </div>
              <p className="text-sm text-primary-100 mt-1">
                {currentTime.toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{trueCount}</p>
              <p className="text-sm text-primary-100">True/Mostly True</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-red-400">{falseCount}</p>
              <p className="text-sm text-primary-100">False/Mostly False</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-yellow-400">{pendingCount}</p>
              <p className="text-sm text-primary-100">Checking</p>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Claims ({factChecks.length})
            </button>
            {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat 
                    ? 'bg-primary-600 text-white' 
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
        <div className="space-y-4">
          {filteredChecks.map((check) => (
            <article key={check.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
                      <span className="font-mono bg-slate-100 px-2 py-1 rounded">{check.timestamp}</span>
                      <span>•</span>
                      <span className="font-medium">{check.speaker}</span>
                      <span>•</span>
                      <span>{CATEGORY_ICONS[check.category]} {check.category.replace('-', ' ')}</span>
                    </div>
                    
                    <blockquote className="text-lg font-medium text-slate-900 mb-4 border-l-4 border-primary-500 pl-4">
                      "{check.statement}"
                    </blockquote>

                    {check.status !== 'pending' && (
                      <>
                        <div className="bg-slate-50 rounded-lg p-4 mb-4">
                          <p className="text-slate-700 leading-relaxed">{check.explanation}</p>
                        </div>

                        {check.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <span className="text-sm text-slate-500">Sources:</span>
                            {check.sources.map((source, idx) => (
                              <span key={idx} className="text-sm text-primary-600 hover:underline cursor-pointer">
                                {source}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-16 h-16 ${STATUS_COLORS[check.status]} rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg`}>
                      {check.status === 'pending' ? '⏳' : STATUS_LABELS[check.status][0]}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      check.status === 'pending' ? 'bg-gray-100 text-gray-600' :
                      ['true', 'mostly-true'].includes(check.status) ? 'bg-green-100 text-green-700' :
                      ['false', 'mostly-false'].includes(check.status) ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {STATUS_LABELS[check.status]}
                    </span>
                  </div>
                </div>
              </div>
            </article>
          ))}

          {filteredChecks.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">No fact checks in this category yet.</p>
              <p className="text-slate-400">Check back as the speech continues!</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="mb-2">Facts of the Union • Independent Fact Checking</p>
          <p className="text-sm">Sources: FactCheck.org, PolitiFact, Bureau of Labor Statistics, and verified primary sources.</p>
          <p className="text-xs mt-4 text-slate-500">© 2025 Facts of the Union. All fact checks are independently verified.</p>
        </div>
      </footer>
    </div>
  )
}

export default App
