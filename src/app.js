if (window.location.hostname !== 'settings.uniot.io')
  window.location.replace('http://settings.uniot.io')

if (localStorage.account)
  document.getElementById('acc').value = localStorage.account

function get (url, success) {
  var xhr = new XMLHttpRequest()
  xhr.open('GET', url)
  xhr.onreadystatechange = function () {
    if (xhr.readyState > 3 && xhr.status === 200)
      success(xhr.responseText)
  }
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest')
  xhr.send()
}

function scan () {
  var btn = document.getElementById('refresh')
  var list = document.getElementById('ssid-list')
  btn.disabled = true
  list.innerHTML = ''

  get('/scan', function (res) {
    btn.disabled = false
    res = JSON.parse(res)
    res = res.filter(function (value, index, self) {
      return self.indexOf(value) === index
    })
    var options = ''
    for (var i = 0; i < res.length; i++)
      options += '<option value="' + res[i] + '"/>'
    list.innerHTML = options
  })
}

function toggle () {
  var states = {
    password: 'text',
    text: 'password'
  }
  var pass = document.getElementById('pass')
  pass.type = states[pass.type]
}
