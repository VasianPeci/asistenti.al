import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  CORS_ORIGIN: z.string().optional(),
  GOOGLE_CLOUD_PROJECT: z.string().min(1, "GOOGLE_CLOUD_PROJECT is required"),
  GOOGLE_CLOUD_LOCATION: z.string().min(1).default("us-central1"),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  VERTEX_MODEL: z.string().min(1).default("gemini-1.5-flash"),
  VERTEX_RAG_CORPUS: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[env] Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
