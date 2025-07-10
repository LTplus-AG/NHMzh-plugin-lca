type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level?: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private level: LogLevel;
  private prefix: string;
  private enableTimestamp: boolean;

  constructor(config: LoggerConfig = {}) {
    // Validate LOG_LEVEL from environment
    const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
    const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const isValidLogLevel = (level: string | undefined): level is LogLevel => {
      return level !== undefined && validLogLevels.includes(level as LogLevel);
    };
    
    // Use validated log level or fall back to defaults
    if (config.level && isValidLogLevel(config.level)) {
      this.level = config.level;
    } else if (isValidLogLevel(envLogLevel)) {
      this.level = envLogLevel;
    } else {
      this.level = 'info'; // Default fallback
    }
    
    this.prefix = config.prefix || '[LCA-Backend]';
    this.enableTimestamp = config.enableTimestamp !== false;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : '';
    const parts = [
      timestamp,
      this.prefix,
      `[${level.toUpperCase()}]`,
      message
    ].filter(Boolean);
    
    return parts.join(' ');
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data || '');
    }
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), data || '');
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Create singleton instance
const logger = new Logger();

export default logger; 