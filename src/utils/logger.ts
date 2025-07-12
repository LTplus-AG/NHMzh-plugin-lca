type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  enableTimestamp?: boolean;
}

class Logger {
  private level: LogLevel;
  private prefix: string;
  private enableTimestamp: boolean;
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(config: LoggerConfig = { level: 'info' }) {
    // Validate and sanitize log level
    const validLogLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    if (validLogLevels.includes(config.level)) {
      this.level = config.level;
    } else {
      console.warn(`Invalid log level "${config.level}", defaulting to "info"`);
      this.level = 'info';
    }
    
    // Validate and sanitize prefix
    this.prefix = typeof config.prefix === 'string' && config.prefix.trim() 
      ? config.prefix.trim() 
      : '[LCA]';
    
    // Validate enableTimestamp
    this.enableTimestamp = typeof config.enableTimestamp === 'boolean' 
      ? config.enableTimestamp 
      : true;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.enableTimestamp ? new Date().toISOString() : '';
    const parts = [
      timestamp,
      this.prefix,
      `[${level.toUpperCase()}]`,
      message
    ].filter(Boolean);
    
    return parts.join(' ');
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message), data ?? '');
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), data ?? '');
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), data ?? '');
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message), error ?? '');
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Helper function to validate log level from environment
const getValidatedLogLevel = (): LogLevel => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase();
  const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  
  if (envLevel && validLevels.includes(envLevel as LogLevel)) {
    return envLevel as LogLevel;
  }
  
  return 'info'; // Default fallback
};

// Create singleton instance with validated config
const logger = new Logger({
  level: getValidatedLogLevel(),
  prefix: '[LCA]',
  enableTimestamp: true
});

export default logger;
export { Logger };
export type { LogLevel, LoggerConfig }; 