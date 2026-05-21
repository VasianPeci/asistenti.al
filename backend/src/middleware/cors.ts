import cors, { CorsOptions } from "cors";
import { env } from "../config/env";

const ALLOWED_PATTERNS: RegExp[] = [
  /^http:\/\/localhost:5173$/,
  /^http:\/\/127\.0\.0\.1:5173$/,
  /^https:\/\/([a-z0-9-]+\.)*web\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)*firebaseapp\.com$/i,
];

function isAllowed(origin: string): boolean {
  if (env.CORS_ORIGIN && origin === env.CORS_ORIGIN) return true;
  return ALLOWED_PATTERNS.some((rx) => rx.test(origin));
}

const options: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowed(origin)) return callback(null, true);
    return callback(new Error(`CORS: origin not allowed: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 86400,
};

export const corsMiddleware = cors(options);
