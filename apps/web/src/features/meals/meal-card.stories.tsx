import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { RISOTTO, TIKKA, TODAY } from '@/test/sample-data';
import { withRouter } from '@/test/story-router';
import { MealCard } from './meal-card';
import { MealThumb } from './meal-thumb';

const meta = {
  title: 'Meals/MealCard',
  component: MealCard,
  args: { meal: TIKKA, today: TODAY },
  decorators: [withRouter, (Story) => <div className="w-56">{Story()}</div>],
} satisfies Meta<typeof MealCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('link', { name: /Chicken tikka masala/ })).toHaveAttribute(
      'href',
      '/meals/1',
    );
    await expect(canvas.getByText('Last had 2 weeks ago')).toBeInTheDocument();
  },
};

export const NeverHad: Story = { args: { meal: RISOTTO } };

/** The placeholder shown until a meal has a photo. */
export const Placeholder: StoryObj<typeof MealThumb> = {
  render: () => <MealThumb path={null} className="size-20" />,
};
