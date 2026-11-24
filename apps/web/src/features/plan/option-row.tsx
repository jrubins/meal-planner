import type { DinnerOption, HouseholdMember, VoteValue } from '@app/shared';
import { cn } from 'cn';
import { Check, ThumbsDown, ThumbsUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MealThumb } from '@/features/meals/meal-thumb';
import { memberName } from '@/lib/format';

interface OptionRowProps {
  option: DinnerOption;
  me: string;
  members: HouseholdMember[];
  onVote: (vote: VoteValue | 'none') => void;
  onChoose: () => void;
  onRemove: () => void;
}

/** One proposed meal for a night: everyone's votes, my thumbs up/down, and pick/remove. */
export function OptionRow({ option, me, members, onVote, onChoose, onRemove }: OptionRowProps) {
  const myVote = option.votes.find((v) => v.userId === me)?.value;
  const others = option.votes.filter((v) => v.userId !== me);
  const name = (userId: string) => {
    const member = members.find((m) => m.userId === userId);
    return member ? memberName(member, me) : 'Someone';
  };

  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2 py-1.5',
        option.chosen && 'bg-accent text-accent-foreground',
      )}
    >
      <MealThumb path={option.meal.coverPhotoPath} className="size-9" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug font-medium">
          {option.meal.name}
          {option.chosen ? <span className="sr-only"> (chosen)</span> : null}
        </p>
        {others.length > 0 ? (
          <p className="text-muted-foreground flex flex-wrap gap-x-2 text-xs">
            {others.map((vote) => (
              <span key={vote.userId} className="inline-flex items-center gap-1">
                {name(vote.userId)}
                {vote.value === 'up' ? (
                  <ThumbsUp className="text-vote-up size-3" aria-label="likes it" />
                ) : (
                  <ThumbsDown className="text-vote-down size-3" aria-label="doesn’t" />
                )}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', myVote === 'up' && 'bg-vote-up/15 text-vote-up')}
          aria-label={`Thumbs up for ${option.meal.name}`}
          aria-pressed={myVote === 'up'}
          onClick={() => onVote(myVote === 'up' ? 'none' : 'up')}
        >
          <ThumbsUp className={cn(myVote === 'up' && 'fill-current')} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn('size-8', myVote === 'down' && 'bg-vote-down/15 text-vote-down')}
          aria-label={`Thumbs down for ${option.meal.name}`}
          aria-pressed={myVote === 'down'}
          onClick={() => onVote(myVote === 'down' ? 'none' : 'down')}
        >
          <ThumbsDown className={cn(myVote === 'down' && 'fill-current')} />
        </Button>
        {option.chosen ? (
          <span className="text-accent-foreground inline-flex h-8 items-center gap-1 px-2 text-xs font-medium">
            <Check className="size-3.5" aria-hidden />
            Picked
          </span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            aria-label={`Pick ${option.meal.name}`}
            onClick={onChoose}
          >
            Pick
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-8"
          aria-label={`Remove option ${option.meal.name}`}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    </li>
  );
}
