import { Terminal } from 'xterm-headless';

/**
 * @public
 */
export declare class ShellSession {
    constructor(ptyProcess: any);
    /* Excluded from this release type: _output */
    /* Excluded from this release type: _events */
    /* Excluded from this release type: _listeners */
    /* Excluded from this release type: _ptyProcess */
    /* Excluded from this release type: _stabilizer */
    /* Excluded from this release type: _term */
    resize(cols: any, rows: any): Promise<void>;
    expect(str: any, timeoutMs?: number): Promise<void>;
    retry(callback: any, timeoutMs?: number): Promise<any>;
    send(data: any): Promise<void>;
    capture(name: any, extra?: {}): Promise<void>;
}

/**
 * @public
 */
export declare class ShellTester {
    constructor({ shellCommand, }?: {
        shellCommand?: string;
    });
    /* Excluded from this release type: _shellCommand */
    /* Excluded from this release type: _sessionsDefinitions */
    /**
     * @param {string} name - The session name
     * @param {(session: ShellSession) => Promise<void>} callback - An async function that automates this shell session
     */
    session(name: string, callback: (session: ShellSession) => Promise<void>): void;
    run(argv?: string[]): Promise<void>;
    /* Excluded from this release type: _runSession */
}

declare class Stabilizer {
    _lastTime: number;
    debounce(): void;
    get _timeToStabilize(): number;
    waitUntilStabilized(): Promise<void>;
}

export { }
