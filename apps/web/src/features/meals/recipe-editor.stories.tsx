import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SAMPLE_RECIPE } from '@/test/sample-data';
import { RecipeEditor } from './recipe-editor';

const meta = {
  title: 'Meals/RecipeEditor',
  component: RecipeEditor,
  args: { recipe: null, onSave: fn(async () => {}), onCancel: fn() },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof RecipeEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Typing a recipe in from scratch; blank rows are left out. */
export const NewRecipe: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Servings'), '2');
    await userEvent.click(canvas.getByRole('button', { name: 'Add ingredient' }));
    await userEvent.type(canvas.getByLabelText('Ingredient 1 amount'), '200 g');
    await userEvent.type(canvas.getByLabelText('Ingredient 1'), 'spaghetti');
    await userEvent.click(canvas.getByRole('button', { name: 'Add ingredient' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add step' }));
    await userEvent.type(canvas.getByLabelText('Step 1'), 'Boil the pasta.');
    await userEvent.click(canvas.getByRole('button', { name: 'Save recipe' }));
    await expect(args.onSave).toHaveBeenCalledWith({
      title: null,
      servings: '2',
      prepTime: null,
      cookTime: null,
      ingredients: [
        { section: null, amount: '200 g', item: 'spaghetti', note: null, excluded: false },
      ],
      steps: ['Boil the pasta.'],
      notes: null,
      adjustedSteps: null,
    });
  },
};

/** Reordering and removing rows of an existing recipe. */
export const EditExisting: Story = {
  args: { recipe: SAMPLE_RECIPE },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Move step 2 up' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Remove ingredient 1' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Save recipe' }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: SAMPLE_RECIPE.ingredients.slice(1),
        steps: [SAMPLE_RECIPE.steps[1], SAMPLE_RECIPE.steps[0], ...SAMPLE_RECIPE.steps.slice(2)],
      }),
    );
  },
};

/** An ingredient row with an amount but no ingredient is caught before saving. */
export const MissingIngredient: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add ingredient' }));
    await userEvent.type(canvas.getByLabelText('Ingredient 1 amount'), '2');
    await userEvent.click(canvas.getByRole('button', { name: 'Save recipe' }));
    await expect(await canvas.findByRole('alert')).toHaveTextContent('Ingredient is required');
    await expect(args.onSave).not.toHaveBeenCalled();
  },
};
