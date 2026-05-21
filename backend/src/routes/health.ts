import { Router } from "express";
import { env } from "../config/env";

export const healthRouter: Router = Router();

const startedAt = Date.now();

healthRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "asistenti-backend",
    version: "0.1.0",
    environment: env.NODE_ENV,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  });
});
