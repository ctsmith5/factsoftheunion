import express from 'express'
import cors from 'cors'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer } from 'http'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

app.use(cors())
app.use(express.json())

// In-memory fact checks storage
let factChecks = [
  {
    id: '1',
    timestamp: '21:05',
    speaker: 'President',
    statement: 'Our economy has created over 15 million jobs since I took office.',
    category: 'economy',
    status: 'mostly-true',
    explanation: 'According to Bureau of Labor Statistics data, approximately 14.8 million jobs have been created during this administration.',
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
  }
]

// Broadcast to all connected clients
function broadcast(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data))
    }
  })
}

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected')
  
  // Send current fact checks to new client
  ws.send(JSON.stringify({ type: 'init', data: factChecks }))
  
  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

// REST API endpoints
app.get('/api/fact-checks', (req, res) => {
  res.json(factChecks)
})

app.post('/api/fact-checks', (req, res) => {
  const newCheck = {
    id: Date.now().toString(),
    ...req.body
  }
  factChecks.unshift(newCheck)
  
  // Broadcast to all clients
  broadcast({ type: 'new', data: newCheck })
  
  res.status(201).json(newCheck)
})

app.patch('/api/fact-checks/:id', (req, res) => {
  const { id } = req.params
  const index = factChecks.findIndex(fc => fc.id === id)
  
  if (index === -1) {
    return res.status(404).json({ error: 'Fact check not found' })
  }
  
  factChecks[index] = { ...factChecks[index], ...req.body }
  
  // Broadcast update
  broadcast({ type: 'update', data: factChecks[index] })
  
  res.json(factChecks[index])
})

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const stats = {
    total: factChecks.length,
    true: factChecks.filter(c => c.status === 'true' || c.status === 'mostly-true').length,
    false: factChecks.filter(c => c.status === 'false' || c.status === 'mostly-false').length,
    pending: factChecks.filter(c => c.status === 'pending').length
  }
  res.json(stats)
})

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`WebSocket server ready for real-time updates`)
})
