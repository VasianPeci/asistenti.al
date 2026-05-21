import express from "express";
import { env } from "./config/env";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { healthRouter } from "./routes/health";
import { chatRouter } from "./routes/chat";
import { logger } from "./utils/logger";

const app = express();

app.use(corsMiddleware);
app.use(express.json({ limit: "1mb" }));

app.use(healthRouter);
app.use(chatRouter);

app.use(notFoundHandler);
app.use(errorHandler);

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});
process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { error: err.message });
});

app.listen(env.PORT, () => {
  logger.info("server started", { port: env.PORT, env: env.NODE_ENV });
});
