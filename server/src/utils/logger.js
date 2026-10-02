/* Minimal structured logger. Keeps stdout clean and machine-readable. */
const ts = () => new Date().toISOString();

export const logger = {
  info: (msg, meta) => console.log(JSON.stringify({ level: 'info', time: ts(), msg, ...meta })),
  warn: (msg, meta) => console.warn(JSON.stringify({ level: 'warn', time: ts(), msg, ...meta })),
  error: (msg, meta) => console.error(JSON.stringify({ level: 'error', time: ts(), msg, ...meta })),
};
