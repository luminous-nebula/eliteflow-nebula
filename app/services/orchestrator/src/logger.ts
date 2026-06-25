type Level = 'info' | 'warn' | 'error';

function emit(level: Level, msg: string, extra?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${msg}`;
  if (level === 'error') console.error(line, extra ?? '');
  else if (level === 'warn') console.warn(line, extra ?? '');
  else console.log(line, extra ?? '');
}

export const log = {
  info: (msg: string, extra?: unknown) => emit('info', msg, extra),
  warn: (msg: string, extra?: unknown) => emit('warn', msg, extra),
  error: (msg: string, extra?: unknown) => emit('error', msg, extra),
};
