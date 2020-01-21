const fs = require('fs')

const lockFile = 'package-lock.json'
const hardLockFile = 'package-hard-lock.json'

const isObject = (item) => typeof item === 'object' && !Array.isArray(item)

const merge = (target, source, deep = false) => {
  if (deep || !Object.assign) {
    const isDeep = (prop) =>
      isObject(source[prop]) &&
      target !== null &&
      target.hasOwnProperty(prop) &&
      isObject(target[prop])
    const replaced = Object.getOwnPropertyNames(source)
      .map((prop) => ({
        [prop]: isDeep(prop) ? merge(target[prop], source[prop], deep) : source[prop]
      }))
      .reduce((a, b) => ({
        ...a,
        ...b
      }), {})

    return {
      ...target,
      ...replaced
    }
  } else {
    return Object.assign(target, source)
  }
}

const lockFileExists = fs.existsSync(lockFile)
const hardLockFileExists = fs.existsSync(hardLockFile)

const lockFileContents = lockFileExists ? fs.readFileSync(lockFile, 'utf8') : '{}'
const hardLockFileContents = hardLockFileExists ? fs.readFileSync(hardLockFile, 'utf8') : '{}'

const lockFileObject = JSON.parse(lockFileContents)
const hardLockFileObject = JSON.parse(hardLockFileContents)

const data = JSON.stringify(merge(lockFileObject, hardLockFileObject, true), null, 2)
fs.writeFileSync(lockFile, data)
