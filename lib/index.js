"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShellSession = exports.ShellTester = void 0;
const pty = __importStar(require("node-pty"));
const fs_1 = __importDefault(require("fs"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const xterm_headless_1 = require("xterm-headless");
/**
 * API for the `shell-tester` library.
 * Create a `ShellTester` instance to test your shell setup.
 * @public
 */
class ShellTester {
    /**
     * @param options - The options to create the `ShellTester`.
     */
    constructor(options = {}) {
        this._sessionsDefinitions = [];
        const { shellCommand = process.env.SHELL || 'sh' } = options;
        this._shellCommand = shellCommand;
    }
    /**
     * Register a new session to be tested. The session will not be run until `run()` is called.
     *
     * @param name - The session name.
     *  This can be used to filter the session to be run from the command line.
     * @param callback - An async function that automates this shell session.
     *  The function will be called with a {@link ShellSession} instance.
     */
    session(name, callback) {
        this._sessionsDefinitions.push({
            name,
            callback,
        });
    }
    /**
     * Runs the registered sessions.
     *
     * @param argv - The command line arguments.
     *  If no argument is passed, it will run all the registered sessions.
     *  If an argument is passed, it will run only the session with the matching name.
     */
    async run(argv = process.argv.slice(2)) {
        require('make-promises-safe');
        const sessionsToRun = argv.length
            ? this._sessionsDefinitions.filter(({ name }) => argv.includes(name))
            : this._sessionsDefinitions;
        for (const sessionDefinition of sessionsToRun) {
            console.log(`Running session ${sessionDefinition.name}`);
            await this._runSession(sessionDefinition);
        }
    }
    async _runSession({ name, callback }) {
        const cols = 80;
        const rows = 16;
        const ptyProcess = pty.spawn('bash', ['-c', this._shellCommand], {
            cols,
            rows,
            name: 'xterm-color',
            cwd: process.cwd(),
            env: process.env,
        });
        const shellSession = new ShellSession(ptyProcess);
        try {
            await callback(shellSession);
        }
        finally {
            await shellSession.capture(name + '_end', { implicit: true });
            ptyProcess.kill();
        }
    }
}
exports.ShellTester = ShellTester;
class Stabilizer {
    constructor() {
        this._lastTime = Date.now();
    }
    debounce() {
        this._lastTime = Date.now();
    }
    get _timeToStabilize() {
        return this._lastTime + 100;
    }
    async waitUntilStabilized() {
        while (Date.now() < this._timeToStabilize) {
            await new Promise((resolve) => setTimeout(resolve, this._timeToStabilize - Date.now()));
        }
    }
}
/**
 * @public
 */
class ShellSession {
    /** @internal */
    constructor(ptyProcess) {
        this._output = '';
        this._events = [{ time: Date.now(), type: 'started' }];
        this._listeners = new Set();
        const { cols, rows } = ptyProcess;
        /** @internal */
        this._ptyProcess = ptyProcess;
        /** @internal */
        this._stabilizer = new Stabilizer();
        /** @internal */
        this._term = new xterm_headless_1.Terminal({ cols, rows });
        ptyProcess.onData((data) => {
            this._stabilizer.debounce();
            this._output += data;
            this._events.push({
                time: Date.now(),
                type: 'output',
                data,
            });
            if (process.env.SHELL_TESTER_DEBUG) {
                console.error(`<= Recv:  ${JSON.stringify(data)}`);
            }
            this._term.write(data);
            this._listeners.forEach((l) => l());
        });
    }
    /**
     * Resizes the terminal.
     */
    async resize(cols = this._term.cols, rows = this._term.rows) {
        await this._stabilizer.waitUntilStabilized();
        this._ptyProcess.resize(cols, rows);
        this._term.resize(cols, rows);
        this._events.push({
            time: Date.now(),
            type: 'resize',
            cols,
            rows,
        });
    }
    /**
     * Waits for the given string to be printed on the terminal.
     * Gives up once `timeoutMs` has elapsed.
     */
    async expect(str, timeoutMs = 10000) {
        await new Promise((resolve, reject) => {
            const check = () => {
                const index = this._output.indexOf(str);
                if (index !== -1) {
                    this._output = this._output.slice(index + str.length);
                    this._listeners.delete(check);
                    console.error(`=> Found: ${JSON.stringify(str)}`);
                    clearTimeout(timeout);
                    resolve();
                }
            };
            const timeout = setTimeout(() => {
                this._listeners.delete(check);
                reject(new Error(`Expected ${JSON.stringify(str)} not found`));
            }, timeoutMs);
            this._listeners.add(check);
            check();
        });
        await this._stabilizer.waitUntilStabilized();
    }
    /**
     * Calls the given `callback()` function repeatedly until it no longer throws an error.
     * Gives up once `timeoutMs` has elapsed.
     */
    async retry(callback, timeoutMs = 20000) {
        const start = Date.now();
        while (true) {
            try {
                return await callback();
            }
            catch (e) {
                if (Date.now() - start > timeoutMs) {
                    throw e;
                }
            }
        }
    }
    /**
     * Send a string to the terminal.
     *
     * Note that newline characters will **not** be added automatically.
     * To send a newline, use `\r`.
     *
     * You can also send control characters such as `\x03` (^C).
     */
    async send(data) {
        await this._stabilizer.waitUntilStabilized();
        this._ptyProcess.write(data);
        this._events.push({
            time: Date.now(),
            type: 'send',
            data,
        });
        console.error(`=> Sent:  ${JSON.stringify(data)}`);
    }
    /**
     * Captures the current terminal state into a file.
     * It also prints the terminal state to the console.
     *
     * It will be written to `tmp/output/${name}.js` and will
     * begin with `SESSION_DATA=`, followed by the JSON-encoded
     * session data.
     *
     * The session data will contain:
     *
     * - `events`: an array of events, each event being an object with the following properties:
     *   - `time`: the time at which the event occurred, in milliseconds since the Unix epoch
     *   - `type`: the type of event, one of:
     *     - `started`: the session has started
     *     - `output`: the terminal has output some text
     *     - `send`: the script has sent some data into the terminal
     *     - `resize`: the terminal has been resized
     *   - `data`: the data that was sent or received
     * - `cols`: the number of columns in the terminal
     * - `rows`: the number of rows in the terminal
     * - `text`: the text that was output by the terminal (an array of lines)
     *
     * Extra properties may be added to the session by passing the `extra` argument.
     */
    async capture(name, extra = {}) {
        const term = this._term;
        const { cols, rows } = this._ptyProcess;
        await this._stabilizer.waitUntilStabilized();
        // Show terminal output
        const text = [];
        console.log('+' + '-'.repeat(cols) + '+');
        console.log('|' + ` Capture: ${name}`.padEnd(cols) + '|');
        console.log('+' + '-'.repeat(cols) + '+');
        const buffer = term.buffer.active;
        for (let i = 0; i < rows; i++) {
            const line = buffer.getLine(i + buffer.viewportY);
            const lineString = line?.translateToString() || ' '.repeat(cols);
            text.push(lineString);
            console.log('|' + lineString + '|');
        }
        console.log('+' + '-'.repeat(cols) + '+');
        // Save result to file
        const events = this._events;
        mkdirp_1.default.sync('tmp/output');
        fs_1.default.writeFileSync(`tmp/output/${name}.js`, 'SESSION_DATA=' + JSON.stringify({ ...extra, events, cols, rows, text }));
    }
}
exports.ShellSession = ShellSession;
