const path = require('path')

const http = require('http')
const express = require('express')
const WebSocket = require('ws')
const CBOR = require('cbor')

const app = express()
const server = http.createServer(app)
const wsServer = new WebSocket.Server({ server, path: '/ws' })

app.use(express.static('src'))

const KEYS = {
  ACTION: 'action'
}

const ACTIONS = {
  STATUS: 0,
  SAVE: 1
}

const netsSamples = [
  [
    ['BSSID_1', 'SSID_1', -70, 0],
    ['BSSID_2', 'SSID_2', -80, 1]
  ],
  [
    ['BSSID_1', 'SSID_1', -30, 0],
    ['BSSID_2', 'SSID_2', -20, 1],
    ['BSSID_3', 'SSID_3', -60, 0]
  ],
  [
    ['BSSID_1', 'SSID_1', -70, 0],
    ['BSSID_2', 'SSID_2', -80, 1],
    ['BSSID_3', 'SSID_3', -60, 0],
    ['BSSID_4', 'SSID_4', -50, 1]
  ]
]

let status = {
  id: 'Device001',
  acc: '',
  nets: netsSamples[0]
}

function broadcast(data) {
  const message = JSON.stringify(data)
  wsServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

setInterval(() => {
  const randomIndex = Math.floor(Math.random() * netsSamples.length)
  status.nets = netsSamples[randomIndex]
  broadcast(status)
}, 3000)

wsServer.on('connection', (ws) => {
  console.log('Client connected')

  ws.send(JSON.stringify(status))

  ws.on('message', (message) => {
    try {
      const decoded = CBOR.decode(message)
      console.log('Decoded message:', decoded)

      if (decoded[KEYS.ACTION] === ACTIONS.STATUS) {
        broadcast(status)
      } else if (decoded[KEYS.ACTION] === ACTIONS.SAVE) {
        status.acc = decoded.acc
        console.log('Settings saved:', status)
        setTimeout(() => {
          broadcast({ success: true })
        }, 3000)
      } else {
        console.error('Unknown action:', decoded[KEYS.ACTION])
      }
    } catch (error) {
      console.error('Error parsing message:', error.message)
    }
  })

  ws.on('close', () => {
    console.log('Client disconnected')
  })
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'config.html'))
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`Listening on: http://localhost:${PORT}/`)
})
