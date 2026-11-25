import { z } from 'zod';
import {
  IMAGE_PROVIDERS,
  IMAGE_QUALITIES,
  resolveImageModel,
} from './features/meals/image-generator.ts';
import { AI_PROVIDERS, resolveModel } from './features/meals/recipe-reader.ts';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.url(),
    /** Comma-separated list of browser origins allowed to call the API. */
    CORS_ORIGINS: commaList,

    // --- Auth (WorkOS AuthKit) ---------------------------------------------------------
    /** WorkOS client ID (client_...): verifies the web app's session tokens. */
    WORKOS_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().startsWith('client_').optional()),
    /**
     * WorkOS API key (sk_...): the API exchanges sign-in codes and refreshes sessions with it.
     * Server-only, never sent to the browser.
     */
    WORKOS_API_KEY: z.preprocess(emptyToUndefined, z.string().startsWith('sk_').optional()),
    /** Encrypts the session cookie. At least 32 characters; changing it signs everyone out. */
    WORKOS_COOKIE_PASSWORD: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
    /**
     * Public URL of the web app. The browser reaches the API through it at /api (a Vercel
     * rewrite in production, Vite's proxy in development), so the session cookie is
     * first-party. Sign-in returns to <WEB_URL>/api/auth/callback.
     */
    WEB_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    /** AuthKit domain, e.g. https://your-app.authkit.app: issues MCP clients' tokens. */
    AUTHKIT_DOMAIN: z.preprocess(emptyToUndefined, z.url().optional()),
    /**
     * Public URL of the MCP endpoint. It is the audience of MCP tokens and must match a
     * Resource Indicator configured in the WorkOS dashboard.
     */
    MCP_RESOURCE_URL: z.preprocess(emptyToUndefined, z.url().optional()),
    /** Optional comma-separated user IDs (user_...) allowed to use the API. Empty: anyone. */
    ALLOWED_USER_IDS: commaList,
    /**
     * Development and test only: lets the API accept locally signed test tokens and enables
     * POST /auth/dev-token. Refused in production.
     */
    AUTH_TEST_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),

    // --- AI (reading recipe photos, through TanStack AI) ----------------------------------
    /** Which provider reads recipe photos: anthropic (default), openai or gemini. */
    AI_PROVIDER: z.preprocess(emptyToUndefined, z.enum(AI_PROVIDERS).default('anthropic')),
    /** The provider's model. Optional for anthropic (claude-opus-5-5); required for the others. */
    AI_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
    /** The provider's API key. Optional: without it, recipe photos are kept but not read. */
    AI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    // --- AI images (pictures of meals without a photo, through TanStack AI) ---------------
    /** Which provider makes meal pictures: openai (default) or gemini. */
    IMAGE_PROVIDER: z.preprocess(emptyToUndefined, z.enum(IMAGE_PROVIDERS).default('openai')),
    /** The provider's image model. Defaults: gpt-image-2.5-flare, gemini-3.1-flash-lite-image. */
    IMAGE_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
    /** OpenAI image quality (cost rises with it): low (default), medium or high. */
    IMAGE_QUALITY: z.preprocess(emptyToUndefined, z.enum(IMAGE_QUALITIES).default('low')),
    /** The image provider's API key. Optional: without it, meals can't get generated pictures. */
    IMAGE_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

    // --- Monitoring ------------------------------------------------------------------------
    SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
    SENTRY_ENVIRONMENT: z.preprocess(emptyToUndefined, z.string().optional()),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

    /** Set automatically on Vercel. */
    VERCEL: z.preprocess(emptyToUndefined, z.string().optional()),
    /** Set automatically on Vercel; used as the Sentry release and reported by /health. */
    VERCEL_GIT_COMMIT_SHA: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .superRefine((env, ctx) => {
    if (env.AI_API_KEY) {
      try {
        resolveModel(env.AI_PROVIDER, env.AI_MODEL);
      } catch (error) {
        ctx.addIssue({ code: 'custom', path: ['AI_MODEL'], message: (error as Error).message });
      }
    }
    if (env.IMAGE_API_KEY) {
      try {
        resolveImageModel(env.IMAGE_PROVIDER, env.IMAGE_MODEL);
      } catch (error) {
        ctx.addIssue({ code: 'custom', path: ['IMAGE_MODEL'], message: (error as Error).message });
      }
    }
    const deployed = env.NODE_ENV === 'production' || env.VERCEL !== undefined;
    if (!deployed) return;
    if (env.AUTH_TEST_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_TEST_SECRET'],
        message: 'must not be set in production (it allows signing in as any user)',
      });
    }
    for (const key of [
      'WORKOS_CLIENT_ID',
      'WORKOS_API_KEY',
      'WORKOS_COOKIE_PASSWORD',
      'WEB_URL',
      'AUTHKIT_DOMAIN',
      'MCP_RESOURCE_URL',
    ] as const) {
      if (!env[key]) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'is required in production' });
      }
    }
  })
  .transform((env) => ({
    ...env,
    MCP_RESOURCE_URL: env.MCP_RESOURCE_URL ?? `http://localhost:${env.PORT}/mcp`,
    WEB_URL: (env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
  }));

export type Config = z.infer<typeof EnvSchema>;

/** Parses and validates environment variables. Throws a readable error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
