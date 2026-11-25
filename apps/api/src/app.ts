import * as Sentry from '@sentry/node';
import { waitUntil } from '@vercel/functions';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import type { Db } from '@app/db';
import { requireUser } from './auth/middleware.ts';
import { createTokenVerifier, type TokenVerifier } from './auth/tokens.ts';
import { createWebSessions } from './auth/web-sessions.ts';
import { createWorkosSessions, type WorkosSessions } from './auth/workos-sessions.ts';
import type { Config } from './config.ts';
import { devAuthRouter } from './features/auth/dev-auth.routes.ts';
import { sessionRouter } from './features/auth/session.routes.ts';
import { healthRouter } from './features/health/health.routes.ts';
import { createHealthService } from './features/health/health.service.ts';
import { householdRouter } from './features/household/household.routes.ts';
import { createHouseholdService } from './features/household/household.service.ts';
import { mealsRouter } from './features/meals/meals.routes.ts';
import { createMealsService } from './features/meals/meals.service.ts';
import { createPostgresPhotoStore } from './features/meals/photo-store.ts';
import { createClaudeRecipeReader, type RecipeReader } from './features/meals/recipe-reader.ts';
import { mcpHandlers, mcpMetadataRouter } from './features/mcp/mcp.routes.ts';
import { planRouter } from './features/plan/plan.routes.ts';
import { createPlanService } from './features/plan/plan.service.ts';
import { errorHandler, notFoundHandler } from './middleware/error-handler.ts';

export interface AppDeps {
  config: Config;
  db: Db;
  logger: Logger;
  /** Defaults to one built from config; tests may pass their own. */
  verifier?: TokenVerifier;
  /** WorkOS web sign-in. Defaults to one built from config (when configured); tests pass a fake. */
  workos?: WorkosSessions;
  /** Reads recipe photos. Defaults to Claude when ANTHROPIC_API_KEY is set; tests pass a fake. */
  recipeReader?: RecipeReader | null;
}

/**
 * Builds the Express app from its dependencies. This is the composition root: the only place
 * that creates services from the database and mounts their routers. No side effects, so tests
 * can create one freely.
 *
 * Every route requires a signed-in user except the public ones mounted before `requireUser`.
 */
export function createApp({
  config,
  db,
  logger,
  verifier: injected,
  workos: injectedWorkos,
  recipeReader,
}: AppDeps): Express {
  const app = express();
  const verifier =
    injected ??
    createTokenVerifier({
      workosClientId: config.WORKOS_CLIENT_ID,
      authkitDomain: config.AUTHKIT_DOMAIN,
      mcpResourceUrl: config.MCP_RESOURCE_URL,
      testSecret: config.AUTH_TEST_SECRET,
    });
  const workos =
    injectedWorkos ??
    (config.WORKOS_API_KEY && config.WORKOS_CLIENT_ID && config.WORKOS_COOKIE_PASSWORD
      ? createWorkosSessions({
          apiKey: config.WORKOS_API_KEY,
          clientId: config.WORKOS_CLIENT_ID,
          cookiePassword: config.WORKOS_COOKIE_PASSWORD,
          redirectUri: `${config.WEB_URL}/api/auth/callback`,
          returnTo: config.WEB_URL,
        })
      : undefined);
  const webSessions = createWebSessions({
    verifier,
    workos,
    devSignIn: Boolean(config.AUTH_TEST_SECRET),
    secure: config.WEB_URL.startsWith('https://'),
  });
  // The web app's own origin, plus any configured for cross-origin API clients.
  const trustedOrigins = [...new Set([new URL(config.WEB_URL).origin, ...config.CORS_ORIGINS])];
  const households = createHouseholdService(db);
  // Photos live in Postgres; swap in another PhotoStore to move them to blob storage.
  const meals = createMealsService(db, households, createPostgresPhotoStore(db), {
    reader:
      recipeReader !== undefined
        ? recipeReader
        : config.ANTHROPIC_API_KEY
          ? createClaudeRecipeReader(config.ANTHROPIC_API_KEY)
          : null,
    // On Vercel, keep the function alive until the reading finishes; locally it just runs.
    background: (task) => (config.VERCEL ? waitUntil(task) : void task),
    onError: (error, context) => {
      logger.error({ err: error, ...context }, 'reading a recipe photo failed');
      Sentry.captureException(error, { extra: context });
    },
  });
  const services = { households, meals, plan: createPlanService(db, households, meals) };

  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  // On Vercel, keep the function alive until Sentry has sent this request's events.
  if (config.VERCEL && config.SENTRY_DSN) {
    app.use((req, res, next) => {
      res.on('finish', () => waitUntil(Sentry.flush(2000)));
      next();
    });
  }

  // --- Public ------------------------------------------------------------------------------
  app.use('/health', healthRouter(createHealthService(db, config.VERCEL_GIT_COMMIT_SHA ?? 'dev')));
  if (config.AUTHKIT_DOMAIN) {
    app.use(mcpMetadataRouter(config.MCP_RESOURCE_URL, config.AUTHKIT_DOMAIN));
  }
  app.use('/auth', sessionRouter({ webSessions, workos, webUrl: config.WEB_URL, trustedOrigins }));
  if (config.AUTH_TEST_SECRET) {
    app.use('/auth', devAuthRouter(config.AUTH_TEST_SECRET, webSessions));
  }

  // --- MCP (its own OAuth bearer auth) --------------------------------------------------
  app.post(
    '/mcp',
    ...mcpHandlers({
      verifier,
      services,
      allowedUserIds: config.ALLOWED_USER_IDS,
      resourceUrl: config.MCP_RESOURCE_URL,
    }),
  );
  // Stateless server: no server-initiated stream (GET) or session to end (DELETE).
  app.all('/mcp', (req, res) => {
    res
      .set('Allow', 'POST')
      .status(405)
      .json({
        error: { code: 'method_not_allowed', message: 'Use POST for MCP requests' },
      });
  });

  // --- Everything below requires a signed-in user -----------------------------------------
  app.use(
    requireUser({
      verifier,
      webSessions,
      allowedUserIds: config.ALLOWED_USER_IDS,
      trustedOrigins,
    }),
  );
  app.use('/household', householdRouter(services.households));
  app.use('/meals', mealsRouter(services.meals, services.plan));
  app.use('/plan', planRouter(services.plan));

  app.use(notFoundHandler);
  // Reports 5xx errors to Sentry (no-op while Sentry is disabled), then our JSON error handler.
  Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
}
