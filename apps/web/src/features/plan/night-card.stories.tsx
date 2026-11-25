import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  CURRY,
  EMPTY_NIGHT,
  ME,
  MEMBERS,
  PLANNED_NIGHT,
  TODAY,
  VOTING_NIGHT,
} from '@/test/sample-data';
import { NightCard } from './night-card';

const meta = {
  title: 'Plan/NightCard',
  component: NightCard,
  args: {
    night: PLANNED_NIGHT,
    today: TODAY,
    me: ME,
    members: MEMBERS,
    onPlan: fn(),
    onAddOptions: fn(),
    onShuffle: fn(),
    onClearDinner: fn(),
    onVote: fn(),
    onChoose: fn(),
    onRemoveOption: fn(),
    onUseSuggestion: fn(),
    onProposeSuggestion: fn(),
    onDismissSuggestion: fn(),
  },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
} satisfies Meta<typeof NightCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Tonight, with a meal and a note. */
export const Planned: Story = {};

export const NothingPlanned: Story = {
  args: { night: EMPTY_NIGHT },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Nothing planned yet')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Plan Saturday’s dinner' }));
    await expect(args.onPlan).toHaveBeenCalled();
  },
};

/** Options proposed by Sam: I liked the tacos; Sam isn't keen on the risotto. */
export const Voting: Story = {
  args: { night: VOTING_NIGHT },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const up = canvas.getByRole('button', { name: 'Thumbs up for Fish tacos' });
    await expect(up).toHaveAttribute('aria-pressed', 'true');
    // Pressing a pressed thumb takes the vote back.
    await userEvent.click(up);
    await expect(args.onVote).toHaveBeenCalledWith(11, 'none');
    await userEvent.click(canvas.getByRole('button', { name: 'Thumbs down for Mushroom risotto' }));
    await expect(args.onVote).toHaveBeenCalledWith(12, 'down');
    await userEvent.click(canvas.getByRole('button', { name: 'Pick Fish tacos' }));
    await expect(args.onChoose).toHaveBeenCalledWith(11);
  },
};

export const Chosen: Story = {
  args: {
    night: {
      ...VOTING_NIGHT,
      dinner: { date: VOTING_NIGHT.date, meal: VOTING_NIGHT.options[0]?.meal ?? null, note: null },
      options: VOTING_NIGHT.options.map((option, i) => ({ ...option, chosen: i === 0 })),
    },
  },
};

export const WithSuggestion: Story = {
  args: {
    night: EMPTY_NIGHT,
    suggestion: {
      meal: { id: 4, name: 'Thai green curry', tags: [], coverPhotoPath: null },
      lastEatenOn: CURRY.lastEatenOn,
      timesEaten: 2,
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Last had 3 days ago')).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Plan it' }));
    await expect(args.onUseSuggestion).toHaveBeenCalled();
  },
};

export const OutOfSuggestions: Story = {
  args: { night: EMPTY_NIGHT, suggestion: null },
};

/** In a column of the desktop week board: photo on top, buttons on their own lines. */
export const BoardColumn: Story = {
  args: { night: VOTING_NIGHT },
  decorators: [(Story) => <div className="w-48">{Story()}</div>],
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // The action labels are hidden at this width, but the buttons keep their names.
    await userEvent.click(canvas.getByRole('button', { name: 'Shuffle a meal for Wednesday' }));
    await expect(args.onShuffle).toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: 'Pick Fish tacos' })).toBeVisible();
  },
};
