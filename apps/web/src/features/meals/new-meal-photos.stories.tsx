import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { NewMealPhotosField, type NewMealPhotos } from './new-meal-photos';

/** A 1×1 PNG, so the previews have a real image to show. */
const png = (name: string) =>
  new File(
    [
      Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        ),
        (c) => c.charCodeAt(0),
      ),
    ],
    name,
    { type: 'image/png' },
  );

/** The field is controlled; this keeps its value, and reports each change. */
function Stateful({ onChange }: { onChange: (value: NewMealPhotos) => void }) {
  const [value, setValue] = useState<NewMealPhotos>({ meal: [], recipe: [], generate: false });
  return (
    <NewMealPhotosField
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const meta = {
  title: 'Meals/NewMealPhotos',
  component: Stateful,
  args: { onChange: fn() },
  decorators: [(Story) => <div className="max-w-md">{Story()}</div>],
} satisfies Meta<typeof Stateful>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No photo of the dish: a picture can be generated instead. */
export const Empty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('checkbox', { name: /Generate one with AI/ }));
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ generate: true }),
    );
  },
};

/** Choosing a photo of the dish hides the generate option; removing it brings it back. */
export const WithPhotos: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.upload(canvas.getByLabelText('Choose photos of the dish'), png('dinner.png'));
    await userEvent.upload(canvas.getByLabelText('Choose photos of the recipe'), [
      png('page-1.png'),
      png('page-2.png'),
    ]);
    await expect(canvas.queryByRole('checkbox')).not.toBeInTheDocument();
    await expect(canvas.getByRole('img', { name: 'dinner.png' })).toBeVisible();
    await expect(
      within(canvas.getByRole('list', { name: 'Photos of the recipe' })).getAllByRole('img'),
    ).toHaveLength(2);
    await expect(args.onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        meal: [expect.objectContaining({ name: 'dinner.png' })],
        recipe: [
          expect.objectContaining({ name: 'page-1.png' }),
          expect.objectContaining({ name: 'page-2.png' }),
        ],
      }),
    );

    await userEvent.click(canvas.getByRole('button', { name: 'Remove dinner.png' }));
    await expect(canvas.getByRole('checkbox', { name: /Generate one with AI/ })).toBeVisible();
  },
};
