import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ME, MEMBERS, VOTING_NIGHT } from '@/test/sample-data';
import { OptionRow } from './option-row';

const [liked, disliked] = VOTING_NIGHT.options;
if (!liked || !disliked) throw new Error('sample options missing');

const meta = {
  title: 'Plan/OptionRow',
  component: OptionRow,
  args: {
    option: disliked,
    me: ME,
    members: MEMBERS,
    onVote: fn(),
    onChoose: fn(),
    onRemove: fn(),
  },
  decorators: [(Story) => <ul className="max-w-xl">{Story()}</ul>],
} satisfies Meta<typeof OptionRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sam voted it down; I haven't voted. */
export const NotVoted: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sam')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Thumbs up for Mushroom risotto' }));
    await expect(args.onVote).toHaveBeenCalledWith('up');
    await userEvent.click(canvas.getByRole('button', { name: 'Remove option Mushroom risotto' }));
    await expect(args.onRemove).toHaveBeenCalled();
  },
};

export const VotedUp: Story = { args: { option: liked } };

export const Picked: Story = { args: { option: { ...liked, chosen: true } } };
