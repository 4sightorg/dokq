import environment from './environment.js';
class Logger {
    constructor() {
        this.isProduction = environment.isProduction();
        this.isDevelopment = environment.isDevelopment();
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        this.currentLevel = this.isProduction ? this.levels.warn : this.levels.debug;
    }
    shouldLog(level) {
        return this.levels[level] <= this.currentLevel;
    }
    formatMessage(level, message, ...args) {
        if (this.isProduction) {
            return [message, ...args];
        }
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const levelIcon = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🐛',
            trace: '🔍'
        };
        return [
            `${levelIcon[level]} [${timestamp}] ${message}`,
            ...args
        ];
    }
    error(message, ...args) {
        if (this.shouldLog('error')) {
            console.error(...this.formatMessage('error', message, ...args));
        }
    }
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            console.warn(...this.formatMessage('warn', message, ...args));
        }
    }
    info(message, ...args) {
        if (this.shouldLog('info')) {
            console.info(...this.formatMessage('info', message, ...args));
        }
    }
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            console.log(...this.formatMessage('debug', message, ...args));
        }
    }
    trace(message, ...args) {
        if (this.shouldLog('trace')) {
            console.trace(...this.formatMessage('trace', message, ...args));
        }
    }
    group(groupName, callback) {
        if (this.isDevelopment) {
            console.group(groupName);
            try {
                callback();
            } finally {
                console.groupEnd();
            }
        } else {
            callback();
        }
    }
    time(label) {
        if (this.isDevelopment) {
            console.time(label);
        }
    }
    timeEnd(label) {
        if (this.isDevelopment) {
            console.timeEnd(label);
        }
    }
    table(data) {
        if (this.isDevelopment) {
            console.table(data);
        }
    }
    setLevel(level) {
        if (this.levels.hasOwnProperty(level)) {
            this.currentLevel = this.levels[level];
        }
    }
    dev(message, ...args) {
        if (this.isDevelopment) {
            console.log(`🔧 [DEV]`, message, ...args);
        }
    }
    performance(operation, duration) {
        if (this.isDevelopment) {
            console.log(`⚡ Performance: ${operation} took ${duration.toFixed(2)}ms`);
        } else if (duration > 1000) {
            this.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`);
        }
    }
}
const logger = new Logger();
export const developmentConsole = {
    log: (...args) => logger.debug(...args),
    info: (...args) => logger.info(...args),
    warn: (...args) => logger.warn(...args),
    error: (...args) => logger.error(...args),
    debug: (...args) => logger.debug(...args),
    trace: (...args) => logger.trace(...args),
    group: (name, callback) => logger.group(name, callback),
    time: (label) => logger.time(label),
    timeEnd: (label) => logger.timeEnd(label),
    table: (data) => logger.table(data)
};
export default logger; 