import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { ApiErrorSchema, MealSchema, NightSchema, WeekSchema } from '@app/shared';
import express from 'express';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import request from 'supertest';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mcpMetadataRouter } from '../src/features/mcp/mcp.routes.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

const AUTHKIT = 'https://example.authkit.app';
const { app, db } = createTestApp({ AUTHKIT_DOMAIN: AUTHKIT });
let server: Server;
let mcpUrl: URL;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  mcpUrl = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`);
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

/** An MCP client signed in as `userId`, like Claude after the OAuth flow. */
async function connect(userId: string): Promise<Client> {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: { headers: { Authorization: await bearer(userId) } },
  });
  await client.connect(transport);
  return client;
}

describe('MCP endpoint', () => {
  it('lists the tools, with instructions for the assistant', async () => {
    const client = await connect(uniqueUserId());
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'get_household',
        'get_week',
        'plan_dinner',
        'propose_options',
        'vote_on_option',
        'choose_option',
        'suggest_meals',
        'shuffle_week',
        'list_meals',
        'create_meal',
      ]),
    );
    expect(client.getInstructions()).toContain('YYYY-MM-DD');
    await client.close();
  });

  it('plans a week in chat: create meals, propose options, vote, choose', async () => {
    const client = await connect(uniqueUserId());
    const tacos = unique('Tacos');
    const pasta = unique('Pasta');
    MealSchema.parse(
      (await client.callTool({ name: 'create_meal', arguments: { name: tacos } }))
        .structuredContent,
    );
    const pastaMeal = MealSchema.parse(
      (await client.callTool({ name: 'create_meal', arguments: { name: pasta, tags: ['Quick'] } }))
        .structuredContent,
    );
    expect(pastaMeal.tags).toEqual(['quick']);

    const week = WeekSchema.parse(
      (await client.callTool({ name: 'get_week', arguments: {} })).structuredContent,
    );
    const date = week.nights[2]?.date ?? week.start;

    // Names work as well as IDs, ignoring case.
    const proposed = NightSchema.parse(
      (
        await client.callTool({
          name: 'propose_options',
          arguments: { date, mealNames: [tacos.toUpperCase()], mealIds: [pastaMeal.id] },
        })
      ).structuredContent,
    );
    expect(proposed.options.map((o) => o.meal.name).sort()).toEqual([pasta, tacos].sort());

    const option = proposed.options.find((o) => o.meal.id === pastaMeal.id);
    if (!option) throw new Error('expected an option');
    const voted = NightSchema.parse(
      (
        await client.callTool({
          name: 'vote_on_option',
          arguments: { optionId: option.id, vote: 'up' },
        })
      ).structuredContent,
    );
    expect(voted.options.find((o) => o.id === option.id)?.votes.map((v) => v.value)).toEqual([
      'up',
    ]);

    const chosen = NightSchema.parse(
      (await client.callTool({ name: 'choose_option', arguments: { optionId: option.id } }))
        .structuredContent,
    );
    expect(chosen.dinner?.meal?.name).toBe(pasta);
    expect(chosen.options.find((o) => o.id === option.id)?.chosen).toBe(true);
    await client.close();
  });

  it('plans a dinner by name or as a note, and explains an unknown meal', async () => {
    const client = await connect(uniqueUserId());
    const name = unique('Curry');
    await client.callTool({ name: 'create_meal', arguments: { name } });

    const night = NightSchema.parse(
      (
        await client.callTool({
          name: 'plan_dinner',
          arguments: { date: '2026-06-01', mealName: name },
        })
      ).structuredContent,
    );
    expect(night.dinner?.meal?.name).toBe(name);

    const note = NightSchema.parse(
      (
        await client.callTool({
          name: 'plan_dinner',
          arguments: { date: '2026-06-02', note: 'Eating out' },
        })
      ).structuredContent,
    );
    expect(note.dinner).toEqual({ date: '2026-06-02', meal: null, note: 'Eating out' });

    const missing = await client.callTool({
      name: 'plan_dinner',
      arguments: { date: '2026-06-03', mealName: unique('Nope') },
    });
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing.content)).toContain('create_meal');
    await client.close();
  });

  it('saves a structured recipe and reads it back', async () => {
    const client = await connect(uniqueUserId());
    const name = unique('Tikka masala');
    const created = MealSchema.parse(
      (
        await client.callTool({
          name: 'create_meal',
          arguments: {
            name,
            recipe: {
              servings: '4',
              ingredients: [
                { section: 'Marinade', amount: '200 g', item: 'yogurt' },
                { section: 'Sauce', amount: '1 tbsp', item: 'garam masala', note: 'toasted' },
              ],
              steps: ['Marinate overnight.', 'Simmer for 15 minutes.'],
            },
          },
        })
      ).structuredContent,
    );

    const read = MealSchema.parse(
      (await client.callTool({ name: 'get_meal', arguments: { mealName: name } }))
        .structuredContent,
    );
    expect(read.recipe).toEqual(created.recipe);
    expect(read.recipe?.ingredients[1]).toEqual({
      section: 'Sauce',
      amount: '1 tbsp',
      item: 'garam masala',
      note: 'toasted',
    });
    await client.close();
  });

  it("acts as the signed-in user, on that user's household only", async () => {
    const alice = await connect(uniqueUserId());
    const bob = await connect(uniqueUserId());
    const name = unique('Squat');

    const added = await alice.callTool({ name: 'create_meal', arguments: { name } });
    const meal = MealSchema.parse(added.structuredContent);

    const MealList = z.object({ meals: MealSchema.array() });
    const aliceList = await alice.callTool({ name: 'list_meals', arguments: {} });
    expect(MealList.parse(aliceList.structuredContent).meals.map((m) => m.id)).toContain(meal.id);
    const bobList = await bob.callTool({ name: 'list_meals', arguments: {} });
    expect(MealList.parse(bobList.structuredContent).meals.map((m) => m.id)).not.toContain(meal.id);

    await alice.close();
    await bob.close();
  });

  it('reports invalid tool input as an error result', async () => {
    const client = await connect(uniqueUserId());
    const result = await client.callTool({ name: 'create_meal', arguments: { name: '' } });
    expect(result.isError).toBe(true);
    await client.close();
  });
});

describe('MCP authorization', () => {
  it('challenges unauthenticated requests with the resource metadata URL', async () => {
    const res = await request(app).post('/mcp').send({}).expect(401);
    expect(res.headers['www-authenticate']).toContain(
      'resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"',
    );
  });

  it('publishes protected resource metadata naming AuthKit', async () => {
    const res = await request(app).get('/.well-known/oauth-protected-resource/mcp').expect(200);
    expect(res.body).toMatchObject({
      resource: 'http://localhost:3000/mcp',
      authorization_servers: [AUTHKIT],
    });
  });

  it('only accepts POST', async () => {
    await request(app).get('/mcp').expect(405);
  });
});

describe('authorization server metadata (for older MCP clients)', () => {
  const upstream = {
    issuer: AUTHKIT,
    authorization_endpoint: `${AUTHKIT}/oauth2/authorize`,
    token_endpoint: `${AUTHKIT}/oauth2/token`,
  };

  function appWith(fetchMetadata: (url: string) => Promise<Response>) {
    const metadataApp = express();
    metadataApp.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    metadataApp.use(mcpMetadataRouter('http://localhost:3000/mcp', AUTHKIT, fetchMetadata));
    metadataApp.use(errorHandler);
    return metadataApp;
  }

  it("passes AuthKit's own metadata through, unchanged and cached", async () => {
    const requested: string[] = [];
    const metadataApp = appWith((url) => {
      requested.push(url);
      return Promise.resolve(Response.json(upstream));
    });

    await request(metadataApp).get('/.well-known/oauth-authorization-server').expect(200, upstream);
    await request(metadataApp).get('/.well-known/oauth-authorization-server').expect(200, upstream);

    expect(requested).toEqual([`${AUTHKIT}/.well-known/oauth-authorization-server`]);
  });

  it('reports a 502 when AuthKit is unavailable', async () => {
    const metadataApp = appWith(() => Promise.resolve(new Response('down', { status: 503 })));
    const res = await request(metadataApp)
      .get('/.well-known/oauth-authorization-server')
      .expect(502);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('bad_gateway');
  });

  it('reports a 502 when AuthKit is unreachable', async () => {
    const metadataApp = appWith(() => Promise.reject(new TypeError('fetch failed')));
    const res = await request(metadataApp)
      .get('/.well-known/oauth-authorization-server')
      .expect(502);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('bad_gateway');
  });
});
