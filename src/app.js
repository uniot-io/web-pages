const ACTIONS = {
  STATUS: 0,
  SAVE: 1
}

const RSSI_THRESHOLD = -75
const SMOOTHING_ALPHA = 0.3

const { div, input, span, label, hr, ul, li, dialog, button, h2, p, footer, article, header, fieldset, br, b, small } =
  van.tags

const language = van.state('en')
const msgOpen = van.state(false)
const msgTitle = van.state('')
const msgText = van.state('')
const wsStatus = van.state(false)
const id = van.state('')
const acc = van.state('')
const newAcc = van.state('')
const nets = van.state([])
const ssid = van.state('')
const ssidHintRequired = van.state(null)
const pass = van.state('')
const passType = van.state('password')

if (localStorage.account) {
  newAcc.val = localStorage.account
}

const tt = (key) => translations[language.val][key] || key
const t = (key) => van.derive(() => tt(key))

let ws = null
const connectWebSocket = () => {
  ws = new WebSocket(`ws://${window.location.host}/ws`)

  ws.onopen = () => {
    wsStatus.val = true
    ws.send(CBOR.encode({ action: ACTIONS.STATUS }))
  }

  ws.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data)

      if (data.id !== undefined) id.val = data.id
      if (data.acc !== undefined) acc.val = data.acc
      if (data.nets !== undefined) nets.val = processNetworks(nets.val, data.nets)
      if (data.success !== undefined) {
        if (data.success) {
          showMsg(tt('success'), tt('connectSuccess'))
        } else {
          showMsg(tt('error'), tt('connectError'))
        }
      }
    } catch (err) {
      console.error(err)
    }
  }

  ws.onclose = () => {
    wsStatus.val = false
    setTimeout(connectWebSocket, 1000)
  }

  ws.onerror = console.error
}

const processNetworks = (oldNets, newNets) => {
  // Create a map with BSSID as key
  const oldNetsMap = new Map(oldNets.map(([bssid, ssid, rssi, secured]) => [bssid, { ssid, rssi, secured }]))

  const combinedNets = []

  for (const [bssid, ssid, rssi, secured] of newNets) {
    if (oldNetsMap.has(bssid)) {
      const oldNet = oldNetsMap.get(bssid)
      const smoothedRssi = Math.round(SMOOTHING_ALPHA * rssi + (1 - SMOOTHING_ALPHA) * oldNet.rssi)

      if (smoothedRssi >= RSSI_THRESHOLD) {
        combinedNets.push([bssid, ssid, smoothedRssi, secured])
      }

      oldNetsMap.delete(bssid)
    } else {
      if (rssi >= RSSI_THRESHOLD) {
        combinedNets.push([bssid, ssid, rssi, secured])
      }
    }
  }

  // Decay RSSI for networks not seen in the current scan
  for (const [bssid, { ssid, rssi, secured }] of oldNetsMap.entries()) {
    const decayedRssi = Math.round(SMOOTHING_ALPHA * -100 + (1 - SMOOTHING_ALPHA) * rssi)

    if (decayedRssi >= RSSI_THRESHOLD) {
      combinedNets.push([bssid, ssid, decayedRssi, secured])
    }
  }

  // Sort strongest first
  return combinedNets.sort((a, b) => b[2] - a[2])
}

const saveSettings = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(CBOR.encode({ action: ACTIONS.SAVE, acc: newAcc.val, ssid: ssid.val, pass: pass.val }))
  } else {
    showMsg(tt('error'), tt('wsNotConnected'))
  }
}

const showMsg = (title, message) => {
  msgTitle.val = title
  msgText.val = message
  msgOpen.val = true
}

const isAccRequired = () => !acc.val && (!newAcc.val || !newAcc.val.trim())
const isAccWarn = () => acc.val && newAcc.val && newAcc.val !== acc.val

const getAccHint = () => {
  if (isAccRequired()) {
    return tt('accRequired')
  }
  if (isAccWarn()) {
    return tt('accWarn')
  }
  if (acc.val && (!newAcc.val || newAcc.val === acc.val)) {
    return tt('accOkSame')
  }
  return tt('accOk')
}

const NetworkField = (net) =>
  li({ style: 'list-style: "🛜 "' }, `(${net[0]}) `, net[1], ' [', net[2], ' dBm, ', net[3] ? '🔒' : '🔓', ']')

const App = () => {
  connectWebSocket()

  return div(
    dialog(
      { open: msgOpen },
      article(
        h2(msgTitle),
        p(msgText),
        footer(
          button(
            {
              class: 'outline',
              onclick: () => {
                msgOpen.val = false
              }
            },
            t('close')
          )
        )
      )
    ),

    article(
      header(b(t('deviceInformation'))),
      div(t('id'), ': ', span(id)),
      div(
        t('acc'),
        ': ',
        van.derive(() => (acc.val ? span(acc) : span(tt('accEmpty'))))
      ),
      div(
        t('wsConnected'),
        ': ',
        van.derive(() => span({ style: `color: ${wsStatus.val ? 'green' : 'red'}` }, wsStatus.val ? t('yes') : t('no')))
      ),
      br(),
      label(
        t('newAcc'),
        ': ',
        input({
          type: 'text',
          name: 'acc',
          value: newAcc,
          'aria-invalid': van.derive(() => Boolean(isAccRequired() || isAccWarn())),
          'aria-describedby': 'accHint',
          oninput: (e) => {
            newAcc.val = e.target.value
          }
        }),
        small({ id: 'accHint' }, van.derive(getAccHint))
      )
    ),

    article(
      header(b(t('networks'))),
      van.derive(() => ul(nets.val.map((d) => NetworkField(d)))),
      hr(),
      label(
        t('ssid'),
        ': ',
        input({
          type: 'text',
          name: 'ssid',
          value: ssid,
          'aria-invalid': ssidHintRequired,
          'aria-describedby': 'ssidHint',
          oninput: (e) => {
            ssidHintRequired.val = null
            ssid.val = e.target.value
          }
        }),
        van.derive(() => small({ id: 'ssidHint' }, ssidHintRequired.val ? t('ssidHint') : null))
      ),
      label(
        t('pass'),
        ': ',
        fieldset(
          { role: 'group' },
          input({
            type: passType,
            name: 'pass',
            value: pass,
            oninput: (e) => {
              pass.val = e.target.value
            }
          }),
          input({
            class: 'outline',
            type: 'submit',
            value: '👁️',
            onclick: () => {
              passType.val = passType.val === 'text' ? 'password' : 'text'
            }
          })
        )
      ),
      input({
        type: 'button',
        value: t('save'),
        onclick: () => {
          if (!ssid.val) {
            ssidHintRequired.val = true
          }
          if (!ssid.val || isAccRequired()) {
            showMsg(tt('error'), tt('fillAllFields'))
          } else {
            saveSettings()
            showMsg(tt('success'), tt('settingsSaved'))
          }
        }
      })
    )
  )
}
