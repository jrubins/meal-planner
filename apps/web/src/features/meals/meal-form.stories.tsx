import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { TIKKA } from '@/test/sample-data';
import { MealForm } from './meal-form';

const meta = {
  title: 'Meals/MealForm',
  component: MealForm,
  args: { onSubmit: fn(async () => {}), onCancel: fn() },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof MealForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewMeal: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Pad thai');
    await userEvent.type(canvas.getByLabelText('Tags'), 'Thai, quick,');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Pad thai', tags: ['thai', 'quick'] }),
      expect.anything(),
    );
  },
};

/** A new meal can also choose photos, or ask for a generated picture. */
export const NewMealWithPhotos: Story = {
  args: { withPhotos: true, submitLabel: 'Add meal' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Name'), 'Fish pie');
    await userEvent.click(canvas.getByRole('checkbox', { name: /Generate one with AI/ }));
    await userEvent.click(canvas.getByRole('button', { name: 'Add meal' }));
    await expect(args.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fish pie' }),
      { meal: [], recipe: [], generate: true },
    );
  },
};

/** The shared schema's messages show next to their fields. */
export const ValidationErrors: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Recipe link'), 'not a link');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(await canvas.findByText('Name is required')).toBeInTheDocument();
    await expect(canvas.getByText('Enter a web address')).toBeInTheDocument();
    await expect(args.onSubmit).not.toHaveBeenCalled();
  },
};

export const EditMeal: Story = {
  args: { meal: { ...TIKKA, description: 'With rice and naan.' } },
};
