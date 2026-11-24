import { randomUUID } from 'node:crypto';
import { DevTokenResponseSchema, HouseholdSchema } from '@app/shared';
import { API_URL } from '../playwright.config.ts';
import { createMeal } from './helpers.ts';
import { expect, test } from './fixtures.ts';

test.describe('household', () => {
  test('joins a partner’s household with their invite code', async ({
    page,
    api,
    playwright,
    capture,
  }) => {
    // The partner's household, set up through the API as them.
    const anonymous = await playwright.request.newContext({ baseURL: API_URL });
    const signIn = await anonymous.post('/auth/dev-token', {
      data: { userId: `e2e-owner-${randomUUID()}` },
    });
    const { token } = DevTokenResponseSchema.parse(await signIn.json());
    await anonymous.dispose();
    const owner = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await owner.patch('/household/me', { data: { displayName: 'Sam' } });
    const theirs = HouseholdSchema.parse(await (await owner.get('/household')).json());
    await owner.dispose();
    // A meal of mine comes along when I join.
    const mine = await createMeal(api);

    await page.goto('/household');
    await page.getByLabel('Your name, as the household sees it').fill('Alex');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await page.getByLabel('Their invite code').fill(theirs.inviteCode.toLowerCase());
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(theirs.name);
    await expect(page.getByText(/Sam & Alex|Alex & Sam/)).toBeVisible();
    await expect(page.getByLabel('Your invite code')).toHaveText(theirs.inviteCode);
    await capture('household');

    await page.getByRole('link', { name: 'Meals' }).click();
    await expect(page.getByText(mine.name)).toBeVisible();
  });

  test('switches the week to start on Sunday', async ({ page }) => {
    await page.goto('/household');
    await page.getByRole('button', { name: 'Sunday' }).click();
    await expect(page.getByRole('button', { name: 'Sunday' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('link', { name: 'Week' }).click();
    await expect(page.getByRole('region').first()).toContainText('Sunday');
  });
});
