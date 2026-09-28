import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET 은 32자 이상이어야 합니다.'),
  SESSION_MAX_AGE_MS: z.coerce.number().default(30 * 60 * 1000),
  FRONTEND_ORIGIN: z.string().url(),
  BACKGROUND_CHECK_BASE_URL: z.string().optional(),
  BACKGROUND_CHECK_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof schema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = schema.safeParse(config);
  if (!parsed.success) {
    throw new Error(`환경변수 오류:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
