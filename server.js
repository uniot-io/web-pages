const express = require('express')
const path = require('path')
const app = express()

app.use(express.static(path.join(__dirname, 'src')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'config.html'))
})

app.get('/min', (req, res) => {
  res.sendFile(path.join(__dirname, 'tmp', 'config.min.html'))
})

app.get('/gz', (req, res) => {
  res.set('Content-Encoding', 'gzip')
  res.set('Content-Type', 'text/html')
  res.sendFile(path.join(__dirname, 'tmp', 'config.min.html.gz'))
})

app.get('/scan', (req, res) => {
  setTimeout(() => res.send(['Matrix', 'Space', 'Space', 'Space', 'Test']), 2000)
})

app.get('/config', (req, res) => {
  res.send(req.query)
})

const port = 3000
app.listen(port, console.log(`Listening on: http://localhost:${port}/`))
