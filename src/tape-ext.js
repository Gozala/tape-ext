// @flow

import * as cluster from "cluster"
import * as path from "path"
import { Builder, Capabilities, logging } from "selenium-webdriver"
import * as firefox from "selenium-webdriver/firefox"
import * as geckodriver from "geckodriver"
import { Command } from "selenium-webdriver/lib/command"
import * as fs from "mz/fs"
import * as fxUtil from "fx-runner/lib/utils"
import finished from "tap-finished"
import glob from "glob"
/*::
import EventEmitter from "events"
*/

const TEST_TIMEOUT = 5000
const OUTPUT_PREFIX = "console.log: WebExtensions:"
const FIN = `---------- FIN ----------`

const findFirefox = async binaryPath => {
  const binary = await fxUtil.normalizeBinary(binaryPath)
  if (fs.exists(binary)) {
    return binary
  } else {
    throw new Error(`Could not find ${binaryPath}`)
  }
}

class Mailbox /*::<x, a>*/ {
  /*::
  size:number
  returned:boolean
  waiting:{resolve({done:false, value:a}|{done:true}):void, reject(x):void}[]
  inbox:a[]
  cancel:() => mixed
  */
  constructor(size, cancel = String) {
    this.size = size
    this.inbox = []
    this.waiting = []
    this.returned = false
    this.cancel = cancel
  }
  static on(target, type, size = 0) {
    const listener = event => mailbox.continue(event)
    const cancel = () => target.removeListener(type, listener)
    const mailbox = new Mailbox(size, cancel)
    target.on(type, listener)
    return mailbox
  }
  return() {
    if (!this.returned) {
      this.returned = true
      this.cancel()
      for (const waiting of this.waiting) {
        waiting.resolve({ done: true })
      }
    }
  }
  continue(message /*:a*/) {
    if (this.returned) {
      throw TypeError("Mailbox already returned")
    } else if (this.waiting.length > 0) {
      const waiting = this.waiting.shift()
      waiting.resolve({ done: false, value: message })
    } else if (this.inbox.length < this.size) {
      this.inbox.push(message)
    }
  }
  next() /*:Promise<{done:true}|{done:false, value:a}>*/ {
    if (this.inbox.length > 0) {
      return Promise.resolve({ done: false, value: this.inbox.shift() })
    } else {
      return new Promise((resolve, reject) => {
        this.waiting.push({ resolve, reject })
      })
    }
  }
}

// const on = async function*(target, type) {
//   const listener = event => emit(event)
//   let emit = event => console.warn(`Missed event ${type}`, event)
//   try {
//     target.on(type, listener)
//     while (true) {
//       yield await new Promise(resolve => {
//         emit = resolve
//       })
//     }
//   } finally {
//     target.removeListener(type, listener)
//   }
// }

/*::
type Message =
  | { type:"test", path:string}
  | { type:"exit" }
*/

const work = async () => {
  const inbox /*:Mailbox<empty, Message>*/ = Mailbox.on(process, "message", 1)

  process.env.MOZ_DISABLE_CONTENT_SANDBOX = "1"
  const binary = await findFirefox(process.env.MOZ_BINARY || "nightly")

  logging.installConsoleHandler()
  const log = new logging.Preferences()
  log.setLevel(logging.Type.BROWSER, logging.Level.DEBUG)

  const capabilities = new Capabilities().set("marionette", true)
  const options = new firefox.Options()
    .setPreference("log", "{level: info}")
    .setBinary(binary)
    .setLoggingPrefs(log)

  if (process.env.HEADLESS === "1") {
    options.headless()
  }

  const service = new firefox.ServiceBuilder(geckodriver.path).setStdio([
    "inherit",
    "inherit",
    "inherit"
  ])

  const driver = await new Builder()
    .forBrowser("firefox")
    .setFirefoxOptions(options)
    .setFirefoxService(service)
    // .withCapabilities(capabilities)
    .build()

  let id = ""

  while (true) {
    const next = await inbox.next()
    if (next.done) {
      break
    } else {
      const { value: message } = next
      switch (message.type) {
        case "test": {
          if (id !== "") {
            console.log(`#### Uninstall WebExtension ${id}`)
            const command = new Command("uninstall addon").setParameter(
              "id",
              id
            )

            await driver.execute(command)
          }

          console.log(`#### Install WebExtension ${message.path}`)
          const command = new Command("install addon")
            .setParameter("path", message.path)
            .setParameter("temporary", true)

          id = await driver.execute(command)
          break
        }
        case "exit": {
          await driver.quit()
          process.exit(0)
          return
        }
      }
    }
  }
}

const MANIFEST = "manifest.json"

const normalizeGlob = pattern => {
  if (pattern.endsWith(MANIFEST)) {
    return pattern
  } else {
    return path.join(pattern, MANIFEST)
  }
}

const supervise = async (program, script, pattern = ".") => {
  cluster.setupMaster({
    stdio: ["ignore", "pipe", "inherit", "ipc"]
  })

  const worker = cluster.fork()
  const tap = finished(result => {
    console.log(`# tests ${result.asserts.length}`)
    console.log(`# pass  ${result.pass.length}`)
    if (result.fail.length > 0) {
      console.log(`# fail  ${result.fail.length}`)
    } else {
      console.log(`# ok`)
    }
    worker.send({ type: "exit" })
    worker.kill()

    if (result.fail.length === 0) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  })

  const globPattern = normalizeGlob(pattern)

  const matches = await new Promise(resolve =>
    glob(globPattern, (error, matches) => resolve(matches || []))
  )

  const tests = matches.map(match =>
    path.join(process.cwd(), path.dirname(match))
  )

  if (tests.length === 0) {
    worker.send({ type: "exit" })
    console.error(`glob ${globPattern} did not found an matches.`)
    process.exit(1)
  } else {
    worker.send({ type: "test", path: tests.shift() })

    worker.process.stdout.on("data", buffer => {
      for (const line of buffer.toString().split("\n")) {
        if (line === `${OUTPUT_PREFIX} ${FIN}`) {
          const test = tests.shift()
          if (test != null) {
            worker.send({ type: "test", path: test })
          } else {
            tap.end()
          }
        } else if (line.startsWith(OUTPUT_PREFIX)) {
          const message = line.substr(OUTPUT_PREFIX.length + 1)
          if (message != "") {
            tap.write(`${message}\n`)
            process.stdout.write(`${message}\n`)
          }
        } else {
          process.stdout.write(`${line}\n`)
        }
      }
    })
  }
}

if (cluster.isMaster) {
  supervise(...process.argv)
} else {
  work()
}
