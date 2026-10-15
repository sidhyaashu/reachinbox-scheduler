export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'access_token',
  'secret',
  'clientsecret',
  'client_secret',
  'authorization',
  'cookie',
  'session',
  'smtppass',
  'smtp_pass',
  'credentials',
]);

export interface LogMeta {
  requestId?: string;
  traceId?: string;
  userId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  message: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  meta?: Record<string, unknown>;
}

export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = redactSensitiveData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

export class Logger {
  constructor(
    private readonly service: string,
    private readonly defaultMeta: LogMeta = {},
    private readonly environment: string = process.env.NODE_ENV || 'development'
  ) {}

  public child(extraMeta: LogMeta): Logger {
    return new Logger(
      this.service,
      { ...this.defaultMeta, ...extraMeta },
      this.environment
    );
  }

  private write(level: LogLevel, message: string, meta?: LogMeta, err?: Error): void {
    const combinedMeta = { ...this.defaultMeta, ...meta };
    const { requestId, traceId, userId, durationMs, ...restMeta } = combinedMeta;

    const logEntry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message,
      requestId,
      traceId,
      userId,
      durationMs,
    };

    if (err) {
      logEntry.error = {
        name: err.name,
        message: err.message,
        code: (err as any).code,
        stack: this.environment !== 'production' ? err.stack : undefined,
      };
    }

    if (Object.keys(restMeta).length > 0) {
      logEntry.meta = redactSensitiveData(restMeta);
    }

    const output = JSON.stringify(logEntry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public debug(message: string, meta?: LogMeta): void {
    if (process.env.LOG_LEVEL === 'debug') {
      this.write('debug', message, meta);
    }
  }

  public info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta);
  }

  public error(message: string, err?: Error, meta?: LogMeta): void {
    this.write('error', message, meta, err);
  }
}

export function createLogger(serviceName: string, defaultMeta?: LogMeta): Logger {
  return new Logger(serviceName, defaultMeta);
}
