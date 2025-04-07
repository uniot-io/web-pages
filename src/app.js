const ACTIONS = {
  STATUS: 0,
  SAVE: 1,
  SCAN: 2
}

const RSSI_THRESHOLD = -75
const SMOOTHING_ALPHA = 0.3

const { details, summary, div, input, span, label, hr, ul, li, dialog, button, h2, h5, form, main, p, footer, article, header, fieldset, br, b, small } =
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
const pass = van.state('')
const passType = van.state('password')

const connecting = van.state(false)
const homeNet = van.state('')
const scanPause = van.state(false)
const accError = van.state(false)
const ssidError = van.state(false)
const passError = van.state(false)
const selectedNet = van.state(null)
const isManualNet = van.state(false)

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
      if (data.homeNet !== undefined) homeNet.val = data.homeNet
      if (data.nets !== undefined) nets.val = processNetworks(nets.val, data.nets)
      if (data.success !== undefined) {
        setLoading(false)
        if (data.success) {
          homeNet.val = ssid.val
          acc.val = newAcc.val || acc.val
          resetForm()
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

  let combinedNets = []

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
  // Sort by SSID
  combinedNets.sort((a, b) => a[1].localeCompare(b[1]))

  // Update selected net position in the list
  if (selectedNet.val !== null) {
    const selectedNetIndex = (selectedNet.val !== null && !isManualNet.val)
      ? oldNets.findIndex(net => net[0] === selectedNet.val[0])
      : null
    // Check if the net already exists in combinedNets based on the first element.
    const existingNetIndex = combinedNets.findIndex(net => net[0] === selectedNet.val[0]);

    // Either remove the net from combinedNets, or clone and modify the provided net value.
    const updatedSelectedNet =
      existingNetIndex !== -1
        ? combinedNets.splice(existingNetIndex, 1)[0]
        : (() => {
            const netCopy = [...selectedNet.val];
            netCopy[2] = null;
            return netCopy;
          })();

    // Insert the updated net at the given index or at the end if selectedNetIndex is out of bounds.
    const insertionIndex = Math.min(selectedNetIndex, combinedNets.length);
    combinedNets.splice(insertionIndex, 0, updatedSelectedNet);
  }

  // Put home network first
  combinedNets = sortHomeNet(combinedNets)

  return combinedNets
}

const sortHomeNet = (networks) => {
  const homeNetIndex = networks.findIndex(net => net[1] === homeNet.val)
  if (homeNetIndex !== -1) {
    const homeNet = networks.splice(homeNetIndex, 1)[0]
    networks.unshift(homeNet)
  }
  return networks
}

const rssiToSignal = (rssi) => {
  if (rssi === null) return 0;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  return 1;
}

const saveSettings = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(CBOR.encode({ action: ACTIONS.SAVE, acc: acc.val || newAcc.val, ssid: ssid.val, pass: pass.val }))
  } else {
    showMsg(tt('error'), tt('wsNotConnected'))
  }
}

const requestScan = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(CBOR.encode({ action: ACTIONS.SCAN }))
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
const isSsidRequired = () => isManualNet.val && !ssid.val.trim()
const isPassRequired = () => selectedNet.val?.[3] && !pass.val.trim()

const getAccHint = () => {
  if (isAccRequired()) {
    return tt('accRequired')
  }
  // if (isAccWarn()) {
  //   return tt('accWarn')
  // }
  // if (acc.val && (!newAcc.val || newAcc.val === acc.val)) {
  //   return tt('accOkSame')
  // }
  // return tt('accOk')
  return ''
}

const setLoading = (isLoading) => {
  connecting.val = isLoading
  scanPause.val = isLoading
  if (isLoading) {
    document.getElementById('accountId')?.setAttribute('readonly', '')
  } else {
    document.getElementById('accountId')?.removeAttribute('readonly')
  }
}

const submit = (e) => {
  e.preventDefault()
  accError.val = isAccRequired()
  ssidError.val = isSsidRequired()
  passError.val = isPassRequired()
  if (!accError.val && !ssidError.val && !passError.val) {
    setLoading(true)
    ssid.val = ssid.val.trim() || selectedNet.val[1]
    saveSettings()
  }
}

const resetForm = () => {
  scanPause.val = false
  selectedNet.val = null
  pass.val = ''
  passError.val = false
  passType.val = 'password'
  ssid.val = ''
  ssidError.val = false
  isManualNet.val = false
}

// Account form component
const DeviceInfo = () =>
  article({ class: "device-info" },
    header(h5("Device Information")),
    div(b(t('id')), ': ', span(id)),
    div(b(t('acc')), ': ', van.derive(() => (acc.val ? span(acc) : span(tt('accEmpty'))))),
    div(
      b(t('webSocket')),
      ': ',
      van.derive(() => span({ style: `color: ${wsStatus.val ? 'green' : 'red'}` }, wsStatus.val ? t('connected') : t('disconnected'))),
    ),
    van.derive(() => !acc.val
      ? div(
          br(),
          input({
            type: "text",
            id: "accountId",
            class: 'account-input',
            placeholder: t('newAcc'),
            value: newAcc,
            'aria-invalid': van.derive(() => accError.val ? 'true' : 'null'),
            "aria-describedby": "accHint",
            oninput: (e) => {
              newAcc.val = e.target.value
              accError.val = false
            }
          }),
          small({
            id: "accHint",
            style: van.derive(() => `display: ${accError.val ? 'block' : 'none'}`)
          }, van.derive(() => getAccHint())),
      )
      : null
    ),
  );

// Network list component
const Networks = () =>
  article({
    class: "networks"
  },
    header(h5("Available Networks")),
    main(
      van.derive(() => div(nets.val.map(net => NetworkItem(net)))),
      OtherNetworkItem()
    ),
  );

const PasswordInput = (bssid) => {
  const fieldsetId = `passFieldset_${bssid}`
  const inputId = `passInput_${bssid}`
  return div(
    fieldset({
      role: 'group',
      id: fieldsetId,
      'aria-invalid': van.derive(() => passError.val ? 'true' : 'null'),
    },
      input({
        type: passType,
        id: inputId,
        class: "password-input",
        placeholder: t('pass'),
        value: pass,
        'aria-invalid': van.derive(() => passError.val ? 'true' : 'null'),
        oninput: (e) => {
          pass.val = e.target.value
          scanPause.val = true
          passError.val = false
        }
      }),
      button({
        class: "password-toggle outline",
        type: "button",
        'aria-invalid': van.derive(() => passError.val ? 'true' : 'null'),
        'data-visible': van.derive(() => passType.val === 'text'),
        onclick: () => {
          passType.val = passType.val === 'text' ? 'password' : 'text'
        }
      }, "")
    ),
    small({
      style: van.derive(() => `display: ${passError.val ? 'block' : 'none'}`)
    }, t('passHint'))
  );
}

// Network item component
const NetworkItem = (network) =>
  details({
    class: "network-item",
    name: "network",
    open: van.derive(() => selectedNet.val?.[0] === network[0]),
    'aria-busy': van.derive(() => connecting.val && selectedNet.val?.[0] === network[0]),
    'data-home-network': van.derive(() => homeNet.val === network[1]),
  },
    summary({
      "data-signal": rssiToSignal(network[2]),
      "data-secured": network[3],
      'data-home-network': van.derive(() => homeNet.val === network[1]),
      onclick: (e) => {
        if (connecting.val) {
          e.preventDefault()
          return
        }
        const prevNetBssid = selectedNet.val?.[0]
        resetForm()
        if (prevNetBssid !== network[0]) {
          selectedNet.val = network
        }
      }
    },
      div({ class: "network-ssid" },
        span(network[1])
      )
    ),
    NetworkDetails(network)
  );

// Network form component
const NetworkDetails = (network) => {
  return form({ onsubmit: (e) => {
    ssid.val = network[1]
    submit(e)
  } },
    [
      div({ class: "network-details" }, [
        b("BSSID: "), span(network[0]),
        br(),
        b("RSSI: "), van.derive(() => network[2] !== null ? span(`${network[2]} dBm`) : span("N/A")),
      ]),
      van.derive(() => (homeNet.val !== network[1]) && network[3] ? PasswordInput(network[0]) : null),
      van.derive(() => homeNet.val !== network[1] ? button({ type: "submit" }, "Connect") : null),
    ]
  );
};

// Other network component
const OtherNetworkItem = () => {
  return details({
    class: "network-item other",
    name: "network",
    open: van.derive(() => isManualNet.val),
    'aria-busy': van.derive(() => connecting.val && isManualNet.val),
  },
    summary({
      onclick: (e) => {
        if (connecting.val) {
          e.preventDefault()
          return
        }
        resetForm()
        isManualNet.val = !isManualNet.val
      }
    },
      div({ class: "network-info" },
        span("Other...")
      )
    ),
    form({ onsubmit: submit },
      input({
        type: "text",
        id: "ssidInput",
        placeholder: "SSID",
        value: ssid,
        'aria-invalid': van.derive(() => ssidError.val ? 'true' : 'null'),
        'aria-describedby': 'ssidHint',
        oninput: (e) => {
          ssid.val = e.target.value
          ssidError.val = false
        }
      }),
      small({
        id: "ssidHint",
        style: van.derive(() => `display: ${ssidError.val ? 'block' : 'none'}`)
      }, t('ssidHint')),
      PasswordInput('other'),
      button({ type: "submit" }, "Connect")
    )
  );
};

const App = () => {
  connectWebSocket();

  setInterval(() => {
    if (!scanPause.val) {
      requestScan();
    }
  }, 5000);

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
    DeviceInfo(),
    Networks()
  );
}
