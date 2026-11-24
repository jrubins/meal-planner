import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { UserMenu } from './user-menu';

const meta = {
  title: 'Auth/UserMenu',
  component: UserMenu,
  args: {
    user: { id: 'user_01', email: 'you@example.com', name: 'Alex Lee' },
    onSignOut: fn(),
  },
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithName: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Alex Lee')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Sign out' }));
    await expect(args.onSignOut).toHaveBeenCalled();
  },
};

/** Dev sign-in users' name is their user ID. */
export const DevUser: Story = {
  args: { user: { id: 'dev-user', email: null, name: 'dev-user' } },
};
