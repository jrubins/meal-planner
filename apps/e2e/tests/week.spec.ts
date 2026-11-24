import { NightSchema } from '@app/shared';
import { createMeal, currentWeek, partnerFor } from './helpers.ts';
import { expect, test, unique } from './fixtures.ts';

test.describe('week plan', () => {
  test('plans a dinner from the meal list', async ({ page, api, capture }) => {
    const meal = await createMeal(api, unique('Lasagne'));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'This week' })).toBeVisible();

    const night = page.getByRole('region', { name: 'Wednesday' });
    await night.getByRole('button', { name: 'Plan Wednesday’s dinner' }).click();

    const dialog = page.getByRole('dialog', { name: 'Plan dinner' });
    await dialog.getByLabel('Search meals').fill(meal.name.slice(0, 12));
    await dialog.getByRole('button', { name: new RegExp(meal.name) }).click();

    await expect(dialog).toBeHidden();
    await expect(night.getByText(meal.name)).toBeVisible();
    await expect(page.getByText('1 of 7 dinners planned')).toBeVisible();
    await capture('week-planned');
  });

  test('plans a night with just a note, and clears it', async ({ page }) => {
    await page.goto('/');
    const night = page.getByRole('region', { name: 'Friday' });
    await night.getByRole('button', { name: 'Plan Friday’s dinner' }).click();
    await page.getByLabel('Or just a note').fill('Eating out');
    await page.getByRole('button', { name: 'Save note' }).click();

    await expect(night.getByText('Eating out')).toBeVisible();
    await night.getByRole('button', { name: 'Clear Friday’s dinner' }).click();
    await expect(night.getByText('Nothing planned yet')).toBeVisible();
  });

  test('votes on options a partner proposed, then picks one', async ({
    page,
    api,
    playwright,
    capture,
  }) => {
    const tacos = await createMeal(api, unique('Fish tacos'));
    const curry = await createMeal(api, unique('Green curry'));
    const partner = await partnerFor(api, (o) => playwright.request.newContext(o), 'Sam');
    const { nights } = await currentWeek(api);
    const date = nights[3]?.date ?? '';
    const proposed = NightSchema.parse(
      await (
        await partner.post('/plan/options', { data: { date, mealIds: [tacos.id, curry.id] } })
      ).json(),
    );
    await partner.put(`/plan/options/${proposed.options[0]?.id}/vote`, { data: { vote: 'up' } });
    await partner.dispose();

    await page.goto('/');
    const night = page.getByRole('region', { name: 'Thursday' });
    await expect(night.getByText('Not decided yet')).toBeVisible();
    // Sam's vote shows by name.
    await expect(night.getByRole('listitem').filter({ hasText: tacos.name })).toContainText('Sam');

    const up = night.getByRole('button', { name: `Thumbs up for ${tacos.name}` });
    await up.click();
    await expect(up).toHaveAttribute('aria-pressed', 'true');
    await night.getByRole('button', { name: `Thumbs down for ${curry.name}` }).click();
    await expect(
      night.getByRole('button', { name: `Thumbs down for ${curry.name}` }),
    ).toHaveAttribute('aria-pressed', 'true');
    await capture('week-voting');

    await night.getByRole('button', { name: `Pick ${tacos.name}` }).click();
    await expect(night.getByText('Picked')).toBeVisible();
    // The picked meal is now the dinner, and stays listed as an option.
    await expect(night.getByText(tacos.name)).toHaveCount(2);
  });

  test('fills empty nights with options to vote on', async ({ page, api }) => {
    for (let i = 0; i < 16; i++) await createMeal(api);
    await page.goto('/');

    await page.getByRole('button', { name: 'Fill empty nights' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Added 14 options' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Options' })).toHaveCount(7);
  });

  test('shuffles a suggestion for one night and plans it', async ({ page, api }) => {
    const meal = await createMeal(api, unique('Only meal'));
    await page.goto('/');
    const night = page.getByRole('region', { name: 'Saturday' });

    await night.getByRole('button', { name: 'Shuffle a meal for Saturday' }).click();
    await expect(night.getByText('How about…')).toBeVisible();
    await night.getByRole('button', { name: 'Plan it' }).click();

    await expect(night.getByText(meal.name)).toBeVisible();
    await expect(night.getByText('How about…')).toHaveCount(0);
  });

  test('moves between weeks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Next week' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Week of/ })).toBeVisible();
    await page.getByRole('link', { name: 'This week' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'This week' })).toBeVisible();
  });
});
