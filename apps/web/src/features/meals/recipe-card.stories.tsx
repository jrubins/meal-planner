import type { Meta, StoryObj } from '@storybook/react-vite';
import { EMPTY_RECIPE } from '@app/shared';
import { expect, fn, userEvent, within } from 'storybook/test';
import { SAMPLE_RECIPE } from '@/test/sample-data';
import { RecipeCard } from './recipe-card';

const meta = {
  title: 'Meals/RecipeCard',
  component: RecipeCard,
  args: { recipe: SAMPLE_RECIPE },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof RecipeCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Ingredients grouped under their sections, numbered steps, notes. */
export const Full: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Marinade' })).toBeInTheDocument();
    await expect(canvas.getByRole('heading', { name: 'Sauce' })).toBeInTheDocument();
    await expect(canvas.getAllByRole('listitem')).toHaveLength(
      SAMPLE_RECIPE.ingredients.length + SAMPLE_RECIPE.steps.length,
    );
    await expect(canvas.getByText('Serves')).toBeInTheDocument();
  },
};

/** Just steps, as a quick typed-in recipe might be. */
export const StepsOnly: Story = {
  args: { recipe: { ...EMPTY_RECIPE, steps: ['Boil the pasta.', 'Toss with pesto.'] } },
};

const creamLeftOut = {
  ...SAMPLE_RECIPE,
  ingredients: SAMPLE_RECIPE.ingredients.map((i) => ({
    ...i,
    excluded: i.item === 'double cream',
  })),
};

/** Leaving out an ingredient from the card. */
export const LeavingOut: Story = {
  args: { onToggleIngredient: fn(), onAdjustSteps: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Leave out double cream' }));
    await expect(args.onToggleIngredient).toHaveBeenCalledWith(6);
  },
};

/** Cream left out, steps not adjusted yet: they still mention it. */
export const LeftOutNotAdjusted: Story = {
  args: { recipe: creamLeftOut, onToggleIngredient: fn(), onAdjustSteps: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/the steps still mention it/)).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Include double cream' })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Adjust steps' }));
    await expect(args.onAdjustSteps).toHaveBeenCalled();
  },
};

/** Adjusted for the cream; the original steps are a click away. */
export const Adjusted: Story = {
  args: {
    recipe: {
      ...creamLeftOut,
      adjustedSteps: {
        leftOut: ['double cream'],
        steps: [
          ...SAMPLE_RECIPE.steps.slice(0, 3),
          'Stir in the chicken and simmer for 5 more minutes.',
        ],
      },
    },
    onToggleIngredient: fn(),
    onAdjustSteps: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Adjusted to leave out double cream.')).toBeInTheDocument();
    await expect(canvas.queryByText(/Stir in the cream/)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Show original' }));
    await expect(canvas.getByText(/Stir in the cream/)).toBeInTheDocument();
  },
};

export const AdjustFailed: Story = {
  args: {
    recipe: creamLeftOut,
    onToggleIngredient: fn(),
    onAdjustSteps: fn(),
    adjustError: 'Couldn’t adjust the steps. Try again.',
  },
};
