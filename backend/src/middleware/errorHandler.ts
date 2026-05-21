import { ErrorRequestHandler, RequestHandler } from "express";
import { logger } from "../utils/logger";
import type { ApiErrorBody } from "../types";

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiErrorBody = {
    error: { code: "not_found", message: `Route not found: ${req.method} ${req.path}` },
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  const isCors = message.startsWith("CORS:");
  const status = isCors ? 403 : 500;
  const code = isCors ? "cors_forbidden" : "internal_error";

  logger.error("request failed", {
    method: req.method,
    path: req.path,
    status,
    error: message,
  });

  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
};
