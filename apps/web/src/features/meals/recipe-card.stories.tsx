import type { Meta, StoryObj } from '@storybook/react-vite';
import { EMPTY_RECIPE } from '@app/shared';
import { expect, within } from 'storybook/test';
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
