import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent } from 'storybook/test';
import { MEALS, sampleMeal, TODAY } from '@/test/sample-data';
import { MealPickerDialog } from './meal-picker-dialog';

const meta = {
  title: 'Plan/MealPickerDialog',
  component: MealPickerDialog,
  args: {
    open: true,
    onOpenChange: fn(),
    mode: 'dinner',
    nightLabel: 'Tuesday, Nov 24',
    meals: MEALS,
    today: TODAY,
    onPickMeal: fn(async () => {}),
    onPickNote: fn(async () => {}),
    onProposeMeals: fn(async () => {}),
    onCreateMeal: fn((name: string) => Promise.resolve(sampleMeal(99, name))),
  },
} satisfies Meta<typeof MealPickerDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlanDinner: Story = {
  play: async ({ args }) => {
    await userEvent.type(screen.getByLabelText('Search meals'), 'taco');
    await userEvent.click(screen.getByRole('button', { name: /Fish tacos/ }));
    await expect(args.onPickMeal).toHaveBeenCalledWith(2);
  },
};

export const JustANote: Story = {
  play: async ({ args }) => {
    await userEvent.type(screen.getByLabelText('Or just a note'), 'Eating out');
    await userEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await expect(args.onPickNote).toHaveBeenCalledWith('Eating out');
  },
};

export const AddOptions: Story = {
  args: { mode: 'options', proposedMealIds: [1] },
  play: async ({ args }) => {
    await expect(screen.getByRole('button', { name: /Chicken tikka masala/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Fish tacos/ }));
    await userEvent.click(screen.getByRole('button', { name: /Thai green curry/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Add 2 options' }));
    await expect(args.onProposeMeals).toHaveBeenCalledWith([2, 4]);
  },
};

export const CreateANewMeal: Story = {
  play: async ({ args }) => {
    await userEvent.type(screen.getByLabelText('Search meals'), 'Pad thai');
    await userEvent.click(screen.getByRole('button', { name: 'Add “Pad thai” as a new meal' }));
    await expect(args.onCreateMeal).toHaveBeenCalledWith('Pad thai');
    await expect(args.onPickMeal).toHaveBeenCalledWith(99);
  },
};

export const NoMealsYet: Story = { args: { meals: [] } };
