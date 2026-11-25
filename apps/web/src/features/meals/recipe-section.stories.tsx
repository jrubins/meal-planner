import type { MealPhoto, RecipeReadStatus } from '@app/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RecipeSection } from './recipe-section';

const photo = (id: number, readStatus: RecipeReadStatus): MealPhoto => ({
  id,
  kind: 'recipe',
  readStatus,
  // No API in Storybook: apiUrl() makes this /api/../favicon.svg, i.e. the app's favicon.
  path: '/../favicon.svg',
  createdAt: '2026-11-24T12:00:00.000Z',
});

const RECIPE = `Chicken tikka masala
Serves 4

Ingredients:
- 600 g chicken thighs
- 200 g yogurt
- 1 tbsp garam masala

Steps:
1. Marinate the chicken overnight.
2. Grill, then simmer in the sauce for 15 minutes.`;

const meta = {
  title: 'Meals/RecipeSection',
  component: RecipeSection,
  args: {
    recipeText: null,
    photos: [],
    uploading: false,
    onAddPhotos: fn(),
    onReread: fn(),
    onDeletePhoto: fn(),
    onEdit: fn(),
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof RecipeSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoRecipeYet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('button', { name: 'Add recipe photo' })).toBeEnabled();
    await expect(canvas.queryByRole('button', { name: 'Edit text' })).not.toBeInTheDocument();
  },
};

export const Reading: Story = {
  args: { photos: [photo(1, 'reading')] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Reading the recipe…')).toBeInTheDocument();
  },
};

/** Two pages read into the text; one photo didn't work and can be tried again. */
export const ReadWithAFailure: Story = {
  args: {
    recipeText: RECIPE,
    photos: [photo(1, 'done'), photo(2, 'failed'), photo(3, 'not_a_recipe')],
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Marinate the chicken overnight/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }));
    await expect(args.onReread).toHaveBeenCalledWith(2);
    await userEvent.click(canvas.getByRole('button', { name: 'Delete recipe photo 3' }));
    await expect(args.onDeletePhoto).toHaveBeenCalledWith(3);
    await userEvent.click(canvas.getByRole('button', { name: 'Edit text' }));
    await expect(args.onEdit).toHaveBeenCalled();
  },
};

export const ReadingNotSetUp: Story = {
  args: { photos: [photo(1, 'unavailable')] },
};
