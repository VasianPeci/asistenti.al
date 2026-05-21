type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, message: string, meta?: Record<string, unknown>): void {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...(meta ?? {}),
  };
  const line = JSON.stringify(entry);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
