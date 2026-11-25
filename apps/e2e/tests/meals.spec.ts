import { MealSchema } from '@app/shared';
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

    await recipe.getByRole('button', { name: 'Type it in' }).click();
    const editor = page.getByRole('dialog', { name: 'Add recipe' });
    await editor.getByLabel('Servings').fill('4');
    await editor.getByRole('button', { name: 'Add ingredient' }).click();
    await editor.getByLabel('Ingredient 1 amount').fill('600 g');
    await editor.getByLabel('Ingredient 1', { exact: true }).fill('chicken thighs');
    await editor.getByLabel('Ingredient 1 section').fill('Marinade');
    await editor.getByRole('button', { name: 'Add step' }).click();
    await editor.getByRole('textbox', { name: 'Step 1', exact: true }).fill('Marinate overnight.');
    await editor.getByRole('button', { name: 'Save recipe' }).click();

    await expect(editor).toBeHidden();
    await expect(recipe.getByRole('heading', { name: 'Marinade' })).toBeVisible();
    await expect(recipe.getByText('chicken thighs')).toBeVisible();
    await expect(recipe.getByText('Marinate overnight.')).toBeVisible();
    await capture('meal-recipe');
  });

  test('leaves an ingredient out, and keeps it left out', async ({ page, api, capture }) => {
    const res = await api.post('/meals', {
      data: {
        name: unique('Tikka masala'),
        recipe: {
          ingredients: [
            { amount: '600 g', item: 'chicken thighs' },
            { amount: '150 ml', item: 'double cream' },
          ],
          steps: ['Brown the chicken.', 'Stir in the cream.'],
        },
      },
    });
    const meal = MealSchema.parse(await res.json());
    await page.goto(`/meals/${meal.id}`);
    const recipe = page.getByRole('region', { name: 'Recipe' });

    await recipe.getByRole('button', { name: 'Leave out double cream' }).click();

    await expect(recipe.getByRole('button', { name: 'Include double cream' })).toBeVisible();
    await expect(recipe.getByText(/Leaving out double cream/)).toBeVisible();
    await expect(recipe.getByRole('button', { name: 'Adjust steps' })).toBeVisible();
    await capture('meal-left-out');

    // Saved with the meal: still left out after a reload.
    await page.reload();
    await expect(recipe.getByRole('button', { name: 'Include double cream' })).toBeVisible();
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
