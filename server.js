var express = require('express')
var path = require('path')
var app = express()

app.use(express.static(path.join(__dirname, 'src')))

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'config.html'))
})

app.get('/scan', function (req, res) {
  setTimeout(() => {
    res.send(['Matrix', 'Space', 'Space', 'Space', 'Test'])
  }, 2000)
})

const port = 3000
app.listen(port, () => {
  console.log('server listening on port ' + port)
})
