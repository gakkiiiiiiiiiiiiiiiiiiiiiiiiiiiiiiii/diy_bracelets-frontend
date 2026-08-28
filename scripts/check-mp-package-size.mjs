import fs from 'node:fs'
import path from 'node:path'

const outputDir = path.resolve(process.cwd(), 'dist/build/mp-weixin')
const maxBytes = 2 * 1024 * 1024

function directoryBytes(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).reduce((total, entry) => {
    if (entry.name === '.DS_Store') return total
    const entryPath = path.join(directory, entry.name)
    return total + (entry.isDirectory() ? directoryBytes(entryPath) : fs.statSync(entryPath).size)
  }, 0)
}

if (!fs.existsSync(outputDir)) {
  throw new Error(`Mini program build output does not exist: ${outputDir}`)
}

const bytes = directoryBytes(outputDir)
const mebibytes = (bytes / 1024 / 1024).toFixed(2)
console.log(`WeChat mini program package: ${bytes} bytes (${mebibytes} MiB)`)

if (bytes > maxBytes) {
  throw new Error(`WeChat mini program package exceeds the 2 MiB single-package limit by ${bytes - maxBytes} bytes`)
}
