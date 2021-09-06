import * as pty from 'node-pty';
/**
 * @public
 */
export interface ShellTesterOptions {
    /**
     * The command to use for launching the shell.
     * Defaults to the `SHELL` environment variable, or `sh` if not set.
     */
    shellCommand?: string;
}
/**
 * API for the `shell-tester` library.
 * Create a `ShellTester` instance to test your shell setup.
 * @public
 */
export declare class ShellTester {
    private _shellCommand;
    /**
     * @param options - The options to create the `ShellTester`.
     */
    constructor(options?: ShellTesterOptions);
    private _sessionsDefinitions;
    /**
     * Register a new session to be tested. The session will not be run until `run()` is called.
     *
     * @param name - The session name.
     *  This can be used to filter the session to be run from the command line.
     * @param callback - An async function that automates this shell session.
     *  The function will be called with a {@link ShellSession} instance.
     */
    session(name: string, callback: (session: ShellSession) => Promise<void>): void;
    /**
     * Runs the registered sessions.
     *
     * @param argv - The command line arguments.
     *  If no argument is passed, it will run all the registered sessions.
     *  If an argument is passed, it will run only the session with the matching name.
     */
    run(argv?: string[]): Promise<void>;
    private _runSession;
}
/**
 * @public
 */
export declare class ShellSession {
    private _output;
    private _events;
    private _listeners;
    private _ptyProcess;
    private _stabilizer;
    private _term;
    /** @internal */
    constructor(ptyProcess: pty.IPty);
    /**
     * Resizes the terminal.
     */
    resize(cols?: number, rows?: number): Promise<void>;
    /**
     * Waits for the given string to be printed on the terminal.
     * Gives up once `timeoutMs` has elapsed.
     */
    expect(str: string, timeoutMs?: number): Promise<void>;
    /**
     * Calls the given `callback()` function repeatedly until it no longer throws an error.
     * Gives up once `timeoutMs` has elapsed.
     */
    retry<T>(callback: () => Promise<T>, timeoutMs?: number): Promise<T>;
    /**
     * Send a string to the terminal.
     *
     * Note that newline characters will **not** be added automatically.
     * To send a newline, use `\r`.
     *
     * You can also send control characters such as `\x03` (^C).
     */
    send(data: string): Promise<void>;
    /**
     * Captures the current terminal state into a file.
     * It also prints the terminal state to the console.
     *
     * It will be written to `tmp/output/${name}.js` and will
     * begin with `SESSION_DATA=`, followed by the JSON-encoded
     * {@link ShellSessionCapturedData | session data}.
     *
     * Extra properties may be added to the session by passing the `extra` argument.
     */
    capture(name: string, extra?: Record<string, any>): Promise<void>;
}
/**
 * The data captured by {@link ShellSession.capture}.
 * It may contain extra properties, as specified by the `extra` argument to {@link ShellSession.capture}.
 *
 * @public
 */
export interface ShellSessionCapturedData {
    /**
     * The events that occurred during the session, up to the point when `capture()` was called.
     */
    events: ShellSessionEvent[];
    /**
     * The number of columns in the terminal, as of the time when `capture()` was called.
     */
    cols: number;
    /**
     * The number of rows in the terminal, as of the time when `capture()` was called.
     */
    rows: number;
    /**
     * The text snapshot that was rendered to the terminal, as of the time when `capture()` was called.
     * Each element is a line of text.
     */
    text: string[];
}
/**
 * An event that occurred during a session.
 * @public
 */
export interface ShellSessionEvent {
    /**
     * The time at which the event occurred, in milliseconds since the Unix epoch.
     */
    time: number;
    /**
     * The type of event.
     */
    type: 'started' | 'output' | 'send' | 'resize';
    /**
     * The data that was sent or received (for `output` and `send` events).
     */
    data?: string;
    /**
     * The number of columns in the terminal (for `resize` events).
     */
    cols?: number;
    /**
     * The number of rows in the terminal (for `resize` events).
     */
    rows?: number;
}
//# sourceMappingURL=index.d.ts.map