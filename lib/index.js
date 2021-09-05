const pty = require('node-pty')
const fs = require('fs')
const mkdirp = require('mkdirp')
const { Terminal } = require('xterm-headless')

/**
 * API `shell-tester` library. Create a `ShellTester` instance to test your shell setup.
 * @public
 */
class ShellTester {
  /**
   * @param {object} options - The options to create the `ShellTester`.
   * @param {string} options.shellCommand - The shell command to run.
   */
  constructor({ shellCommand = process.env.SHELL || 'sh' } = {}) {
    /** @internal */
    this._shellCommand = shellCommand
  }

  /** @internal */
  _sessionsDefinitions = []

  /**
   * Register a new session to be tested. The session will not be run until `run()` is called.
   *
   * @param {string} name - The session name.
   *  This can be used to filter the session to be run from the command line.
   * @param {(session: ShellSession) => Promise<void>} callback - An async function that automates this shell session.
   *  The function will be called with a {@link ShellSession} instance.
   */
  session(name, callback) {
    this._sessionsDefinitions.push({
      name,
      callback,
    })
  }

  /**
   * Runs the registered sessions.
   *
   * @param argv - The command line arguments.
   *  If no argument is passed, it will run all the registered sessions.
   *  If an argument is passed, it will run only the session with the matching name.
   */
  async run(argv = process.argv.slice(2)) {
    require('make-promises-safe')
    const sessionsToRun = argv.length
      ? this._sessionsDefinitions.filter(({ name }) => argv.includes(name))
      : this._sessionsDefinitions
    for (const sessionDefinition of sessionsToRun) {
      console.log(`Running session ${sessionDefinition.name}`)
      await this._runSession(sessionDefinition)
    }
  }

  /** @internal */
  async _runSession({ name, callback }) {
    const cols = 80
    const rows = 16
    const ptyProcess = pty.spawn('bash', ['-c', this._shellCommand], {
      cols,
      rows,
      name: 'xterm-color',
      cwd: process.cwd(),
      env: process.env,
    })
    const shellSession = new ShellSession(ptyProcess)
    try {
      await callback(shellSession)
    } finally {
      await shellSession.capture(name + '_end', { implicit: true })
      ptyProcess.kill()
    }
  }
}

class Stabilizer {
  _lastTime = Date.now()
  debounce() {
    this._lastTime = Date.now()
  }
  get _timeToStabilize() {
    return this._lastTime + 100
  }
  async waitUntilStabilized() {
    while (Date.now() < this._timeToStabilize) {
      await new Promise((resolve) =>
        setTimeout(resolve, this._timeToStabilize - Date.now()),
      )
    }
  }
}

/**
 * @public
 */
class ShellSession {
  /** @internal */
  _output = ''

  /** @internal */
  _events = [{ time: Date.now(), type: 'started' }]

  /** @internal */
  _listeners = new Set()

  /** @internal */
  constructor(ptyProcess) {
    const { cols, rows } = ptyProcess

    /** @internal */
    this._ptyProcess = ptyProcess

    /** @internal */
    this._stabilizer = new Stabilizer()

    /** @internal */
    this._term = new Terminal({ cols, rows })
    ptyProcess.onData((data) => {
      this._stabilizer.debounce()
      this._output += data
      this._events.push({
        time: Date.now(),
        type: 'output',
        data,
      })
      if (process.env.SHELL_TESTER_DEBUG) {
        console.error(`<= Recv:  ${JSON.stringify(data)}`)
      }
      this._term.write(data)
      this._listeners.forEach((l) => l())
    })
  }

  async resize(cols, rows) {
    await this._stabilizer.waitUntilStabilized()
    this._ptyProcess.resize(cols, rows)
    this._term.resize(cols, rows)
    this._events.push({
      time: Date.now(),
      type: 'resize',
      cols,
      rows,
    })
  }

  async expect(str, timeoutMs = 10000) {
    await new Promise((resolve, reject) => {
      const check = () => {
        const index = this._output.indexOf(str)
        if (index !== -1) {
          this._output = this._output.slice(index + str.length)
          this._listeners.delete(check)
          console.error(`=> Found: ${JSON.stringify(str)}`)
          clearTimeout(timeout)
          resolve()
        }
      }
      const timeout = setTimeout(() => {
        this._listeners.delete(check)
        reject(new Error(`Expected ${JSON.stringify(str)} not found`))
      }, timeoutMs)
      this._listeners.add(check)
      check()
    })
    await this._stabilizer.waitUntilStabilized()
  }

  async retry(callback, timeoutMs = 20000) {
    const start = Date.now()
    while (true) {
      try {
        return await callback()
      } catch (e) {
        if (Date.now() - start > timeoutMs) {
          throw e
        }
      }
    }
  }

  async send(data) {
    await this._stabilizer.waitUntilStabilized()
    this._ptyProcess.write(data)
    this._events.push({
      time: Date.now(),
      type: 'send',
      data,
    })
    console.error(`=> Sent:  ${JSON.stringify(data)}`)
  }

  async capture(name, extra = {}) {
    const term = this._term
    const { cols, rows } = this._ptyProcess
    await this._stabilizer.waitUntilStabilized()

    // Show terminal output
    const text = []
    console.log('+' + '-'.repeat(cols) + '+')
    console.log('|' + ` Capture: ${name}`.padEnd(cols) + '|')
    console.log('+' + '-'.repeat(cols) + '+')
    const buffer = term.buffer.active
    for (let i = 0; i < rows; i++) {
      const line = buffer.getLine(i + buffer.viewportY)
      const lineString = line?.translateToString() || ' '.repeat(cols)
      text.push(lineString)
      console.log('|' + lineString + '|')
    }
    console.log('+' + '-'.repeat(cols) + '+')

    // Save result to file
    const events = this._events
    mkdirp.sync('tmp/output')
    fs.writeFileSync(
      `tmp/output/${name}.js`,
      'SESSION_DATA=' + JSON.stringify({ ...extra, events, cols, rows, text }),
    )
  }
}

exports.ShellTester = ShellTester
exports.ShellSession = ShellSession
