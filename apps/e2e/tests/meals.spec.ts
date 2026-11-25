import { createMeal } from './helpers.ts';
import { expect, test, unique } from './fixtures.ts';

/** A 1×1 PNG: a real image the browser can decode and resize. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('meals', () => {
  test('adds a meal, a photo, edits and deletes it', async ({ page, capture }) => {
    const name = unique('Pad thai');
    await page.goto('/meals');
    await page.getByRole('button', { name: 'New meal' }).click();
    const dialog = page.getByRole('dialog', { name: 'New meal' });
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Tags').fill('Thai, quick');
    await dialog.getByRole('button', { name: 'Add meal' }).click();

    // Lands on the new meal's page.
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Tags' })).toHaveText(/thai\s*quick/);

    await page.getByLabel('Upload photos of the dish').setInputFiles({
      name: 'dinner.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    await expect(page.getByRole('img', { name })).toBeVisible();
    await capture('meal-page');

    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Notes').fill('Extra peanuts');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Extra peanuts')).toBeVisible();

    await page.getByRole('button', { name: 'Delete meal' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete meal' }).click();
    await expect(page).toHaveURL(/\/meals$/);
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('adds a recipe photo and types the recipe in', async ({ page, api, capture }) => {
    const meal = await createMeal(api, unique('Tikka masala'));
    await page.goto(`/meals/${meal.id}`);
    const recipe = page.getByRole('region', { name: 'Recipe' });

    await recipe.getByLabel('Upload recipe photos').setInputFiles({
      name: 'recipe.png',
      mimeType: 'image/png',
      buffer: PNG,
    });

    // The test API has no Anthropic key, so the photo is kept but not read.
    await expect(recipe.getByText('Recipe reading isn’t set up')).toBeVisible();
    // A recipe photo never becomes the dish's cover photo.
    await expect(page.getByRole('button', { name: 'Add a photo of the dish' })).toBeVisible();

    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Recipe', { exact: true })
      .fill('Ingredients:\n- chicken\nSteps:\n1. Marinate overnight.');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(recipe.getByText('1. Marinate overnight.')).toBeVisible();
    await capture('meal-recipe');
  });

  test('searches and filters the library', async ({ page, api, capture }) => {
    const soup = await createMeal(api, unique('Tomato soup'));
    const pie = await createMeal(api, unique('Apple pie'));
    await api.patch(`/meals/${pie.id}`, { data: { tags: ['dessert'] } });

    await page.goto('/meals');
    await expect(page.getByText(soup.name)).toBeVisible();
    await capture('meals');

    await page.getByLabel('Search meals').fill('tomato');
    await expect(page.getByText(soup.name)).toBeVisible();
    await expect(page.getByText(pie.name)).toHaveCount(0);

    await page.getByLabel('Search meals').fill('');
    await page.getByRole('button', { name: 'dessert' }).click();
    await expect(page.getByText(pie.name)).toBeVisible();
    await expect(page.getByText(soup.name)).toHaveCount(0);
  });

  test('suggests a meal with "Surprise me"', async ({ page, api }) => {
    const meal = await createMeal(api, unique('Surprise'));
    await page.goto('/meals');
    await page.getByRole('button', { name: 'Surprise me' }).click();
    await expect(page.getByRole('status')).toContainText(meal.name);
  });
});
