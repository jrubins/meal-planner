import { randomUUID } from 'node:crypto';
import {
  DevTokenResponseSchema,
  HouseholdSchema,
  MealSchema,
  WeekSchema,
  type Meal,
  type Week,
} from '@app/shared';
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from '../playwright.config.ts';
import { unique } from './fixtures.ts';

/** Creates a meal through the API (fast set-up), returning it. */
export async function createMeal(api: APIRequestContext, name = unique('Meal')): Promise<Meal> {
  const res = await api.post('/meals', { data: { name } });
  return MealSchema.parse(await res.json());
}

/** This week's plan for the test's user, through the API. */
export async function currentWeek(api: APIRequestContext): Promise<Week> {
  return WeekSchema.parse(await (await api.get('/plan/weeks/current')).json());
}

/** A second person in the test's household (they joined with its invite code). */
export async function partnerFor(
  api: APIRequestContext,
  newContext: (options: object) => Promise<APIRequestContext>,
  displayName: string,
) {
  const { inviteCode } = HouseholdSchema.parse(await (await api.get('/household')).json());
  const anonymous = await newContext({ baseURL: API_URL });
  const signIn = await anonymous.post('/auth/dev-token', {
    data: { userId: `e2e-partner-${randomUUID()}` },
  });
  const { token } = DevTokenResponseSchema.parse(await signIn.json());
  await anonymous.dispose();
  const partner = await newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  await partner.post('/household/join', { data: { inviteCode } });
  await partner.patch('/household/me', { data: { displayName } });
  return partner;
}
