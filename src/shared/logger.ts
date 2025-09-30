type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

type ConsoleMethods = Pick<Console, 'error' | 'warn' | 'info' | 'debug' | 'log'>;

const levelWeights: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

const defaultConsole: ConsoleMethods = {
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    info: console.info ? console.info.bind(console) : console.log.bind(console),
    debug: console.debug ? console.debug.bind(console) : console.log.bind(console),
    log: console.log.bind(console),
};

function inferInitialLevel(): LogLevel {
    // Prefer explicit runtime configuration via environment or global window object.
    const processEnv = typeof process !== 'undefined' ? process.env : undefined;
    const globalObject =
        typeof globalThis !== 'undefined' ? (globalThis as any) : undefined;
    const windowConfig = globalObject?.__LOG_LEVEL ?? globalObject?.window?.__LOG_LEVEL;

    const configuredLevel =
        (processEnv?.LOG_LEVEL || windowConfig)?.toLowerCase?.();

    if (configuredLevel && configuredLevel in levelWeights) {
        return configuredLevel as LogLevel;
    }

    if (processEnv?.NODE_ENV === 'test') {
        return 'silent';
    }

    return 'info';
}

let currentLevel: LogLevel = inferInitialLevel();
let transport: ConsoleMethods = defaultConsole;

export function setLogLevel(level: LogLevel): void {
    currentLevel = level;
}

export function getLogLevel(): LogLevel {
    return currentLevel;
}

export function setLogTransport(nextTransport: ConsoleMethods): void {
    transport = nextTransport;
}

export function resetLogger(): void {
    currentLevel = inferInitialLevel();
    transport = defaultConsole;
}

function shouldLog(level: LogLevel): boolean {
    return levelWeights[currentLevel] >= levelWeights[level];
}

function format(namespace: string | undefined, args: any[]): any[] {
    if (!namespace) {
        return args;
    }
    if (!args.length) {
        return [namespace];
    }
    const [first, ...rest] = args;
    if (typeof first === 'string') {
        return [`[${namespace}] ${first}`, ...rest];
    }
    return [`[${namespace}]`, first, ...rest];
}

function createLogger(namespace?: string) {
    return {
        error: (...args: any[]): void => {
            if (shouldLog('error')) {
                transport.error(...format(namespace, args));
            }
        },
        warn: (...args: any[]): void => {
            if (shouldLog('warn')) {
                transport.warn(...format(namespace, args));
            }
        },
        info: (...args: any[]): void => {
            if (shouldLog('info')) {
                transport.info(...format(namespace, args));
            }
        },
        debug: (...args: any[]): void => {
            if (shouldLog('debug')) {
                transport.debug(...format(namespace, args));
            }
        },
        log: (...args: any[]): void => {
            if (shouldLog('info')) {
                transport.log(...format(namespace, args));
            }
        },
        child: (childNamespace: string) =>
            createLogger(namespace ? `${namespace}:${childNamespace}` : childNamespace),
    };
}

const rootLogger = createLogger();

export type Logger = ReturnType<typeof createLogger>;

export function getLogger(namespace?: string): Logger {
    return namespace ? rootLogger.child(namespace) : rootLogger;
}

export default rootLogger;
