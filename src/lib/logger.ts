import pino, { type Logger, type LoggerOptions } from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

const pinoOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  hooks: {
    logMethod(inputArgs: unknown[], method: (this: unknown, ...args: unknown[]) => void) {
      if (typeof inputArgs[0] === 'string' && typeof inputArgs[1] === 'object' && inputArgs[1] !== null) {
        const [msg, obj, ...rest] = inputArgs
        return method.call(this, obj, msg, ...rest)
      }
      return method.apply(this, inputArgs)
    },
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      }),
}

export const baseLogger: Logger = pino(pinoOptions)

type LogDetails = Record<string, unknown>

interface BurstRecord {
  level: 'error' | 'warn'
  msg: string
  details: LogDetails
  count: number
  firstAt: number
  lastAt: number
  slidingTimeout: NodeJS.Timeout | null
  maxTimeout: NodeJS.Timeout | null
}

export interface BurstCollapsingLogger {
  info: (arg1: unknown, arg2?: unknown) => void
  warn: (arg1: unknown, arg2?: unknown) => void
  error: (arg1: unknown, arg2?: unknown) => void
  debug: (arg1: unknown, arg2?: unknown) => void
  child: (bindings: Record<string, unknown>) => BurstCollapsingLogger
  flush: () => void
  raw: Logger
}

export function createBurstCollapsingLogger(
  targetLogger: Logger,
  options: { windowMs?: number; maxWaitMs?: number } = {}
): BurstCollapsingLogger {
  const windowMs = options.windowMs ?? 200
  const maxWaitMs = options.maxWaitMs ?? 1000
  const activeBursts = new Map<string, BurstRecord>()

  function extractKey(level: string, msg: string, details?: LogDetails): string {
    const code = details?.code || (details?.error && typeof details.error === 'object' && 'code' in details.error ? (details.error as Record<string, unknown>).code : null) || details?.status || msg
    const identity = details?.identity || details?.source || details?.contractType || 'default'
    return `${level}:${String(code)}:${String(identity)}`
  }

  function handleBurstLog(level: 'error' | 'warn', arg1: unknown, arg2?: unknown) {
    let msg = ''
    let details: LogDetails = {}

    if (typeof arg1 === 'string') {
      msg = arg1
      details = typeof arg2 === 'object' && arg2 !== null ? { ...(arg2 as LogDetails) } : {}
    } else if (typeof arg1 === 'object' && arg1 !== null) {
      details = { ...(arg1 as LogDetails) }
      msg = typeof arg2 === 'string' ? arg2 : ''
    } else {
      msg = String(arg1)
    }

    const key = extractKey(level, msg, details)
    const existing = activeBursts.get(key)

    if (!existing) {
      // First occurrence: log immediately
      targetLogger[level](details, msg)

      const burst: BurstRecord = {
        level,
        msg,
        details,
        count: 1,
        firstAt: Date.now(),
        lastAt: Date.now(),
        slidingTimeout: null,
        maxTimeout: null,
      }

      burst.slidingTimeout = setTimeout(() => {
        if (burst.count > 1) {
          targetLogger[level]({ ...burst.details, repeated: burst.count }, burst.msg)
        }
        if (burst.maxTimeout) clearTimeout(burst.maxTimeout)
        activeBursts.delete(key)
      }, windowMs)

      burst.maxTimeout = setTimeout(() => {
        if (burst.count > 1) {
          targetLogger[level]({ ...burst.details, repeated: burst.count }, burst.msg)
          burst.count = 0
        }
      }, maxWaitMs)

      // Unref timers so they do not hold the event loop open if process exits
      burst.slidingTimeout?.unref?.()
      burst.maxTimeout?.unref?.()

      activeBursts.set(key, burst)
    } else {
      // Repeat within burst window: suppress and update count
      existing.count += 1
      existing.lastAt = Date.now()
      existing.details = { ...existing.details, ...details }

      if (existing.slidingTimeout) {
        clearTimeout(existing.slidingTimeout)
      }

      existing.slidingTimeout = setTimeout(() => {
        if (existing.count > 1) {
          targetLogger[level]({ ...existing.details, repeated: existing.count }, existing.msg)
        }
        if (existing.maxTimeout) clearTimeout(existing.maxTimeout)
        activeBursts.delete(key)
      }, windowMs)

      existing.slidingTimeout?.unref?.()
    }
  }

  function flush() {
    for (const burst of activeBursts.values()) {
      if (burst.slidingTimeout) clearTimeout(burst.slidingTimeout)
      if (burst.maxTimeout) clearTimeout(burst.maxTimeout)
      if (burst.count > 1) {
        targetLogger[burst.level]({ ...burst.details, repeated: burst.count }, burst.msg)
      }
    }
    activeBursts.clear()
  }

  return {
    info(arg1: unknown, arg2?: unknown) {
      if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2 !== null) {
        targetLogger.info(arg2, arg1)
      } else {
        targetLogger.info(arg1 as LogDetails, typeof arg2 === 'string' ? arg2 : undefined)
      }
    },
    warn(arg1: unknown, arg2?: unknown) {
      handleBurstLog('warn', arg1, arg2)
    },
    error(arg1: unknown, arg2?: unknown) {
      handleBurstLog('error', arg1, arg2)
    },
    debug(arg1: unknown, arg2?: unknown) {
      if (typeof arg1 === 'string' && typeof arg2 === 'object' && arg2 !== null) {
        targetLogger.debug(arg2, arg1)
      } else {
        targetLogger.debug(arg1 as LogDetails, typeof arg2 === 'string' ? arg2 : undefined)
      }
    },
    child(bindings: Record<string, unknown>) {
      const childPino = targetLogger.child(bindings)
      return createBurstCollapsingLogger(childPino, options)
    },
    flush,
    raw: targetLogger,
  }
}

export const logger: BurstCollapsingLogger = createBurstCollapsingLogger(baseLogger)

export function createSourceLogger(source: 'spot' | 'futures'): BurstCollapsingLogger {
  return logger.child({ source })
}
