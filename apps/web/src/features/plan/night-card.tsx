import type { HouseholdMember, Night, Suggestion, VoteValue } from '@app/shared';
import { cn } from 'cn';
import { ListPlus, Shuffle, Sparkles, UtensilsCrossed, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MealThumb } from '@/features/meals/meal-thumb';
import { lastEaten, monthDay, weekdayName } from '@/lib/format';
import { OptionRow } from './option-row';

export interface NightActions {
  onPlan: () => void;
  onAddOptions: () => void;
  onShuffle: () => void;
  onClearDinner: () => void;
  onVote: (optionId: number, vote: VoteValue | 'none') => void;
  onChoose: (optionId: number) => void;
  onRemoveOption: (optionId: number) => void;
  onUseSuggestion: () => void;
  onProposeSuggestion: () => void;
  onDismissSuggestion: () => void;
}

interface NightCardProps extends NightActions {
  night: Night;
  today: string;
  me: string;
  members: HouseholdMember[];
  /** A shuffled meal to consider for this night; undefined when not shuffling. */
  suggestion?: Suggestion | null;
}

/** One night of the week: its dinner, the options being voted on, and ways to plan it. */
export function NightCard({
  night,
  today,
  me,
  members,
  suggestion,
  ...actions
}: NightCardProps) {
  const isToday = night.date === today;
  const isPast = night.date < today;
  const dinner = night.dinner;
  const headingId = `night-${night.date}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'bg-card rounded-xl border p-4 shadow-xs',
        isToday && 'border-primary/50 ring-primary/15 ring-4',
        isPast && !isToday && 'opacity-75',
      )}
    >
      <header className="mb-3 flex items-baseline gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {weekdayName(night.date)}
        </h2>
        <span className="text-muted-foreground text-sm">{monthDay(night.date)}</span>
        {isToday ? (
          <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
            Tonight
          </span>
        ) : null}
      </header>

      {dinner ? (
        <div className="flex items-center gap-4">
          <MealThumb path={dinner.meal?.coverPhotoPath ?? null} className="size-20" />
          <div className="min-w-0 flex-1">
            {dinner.meal ? (
              <p className="line-clamp-2 text-lg leading-snug font-semibold sm:text-xl">
                {dinner.meal.name}
              </p>
            ) : null}
            {dinner.note ? (
              <p
                className={cn(
                  dinner.meal ? 'text-muted-foreground text-sm' : 'text-lg font-semibold sm:text-xl',
                )}
              >
                {dinner.note}
              </p>
            ) : null}
            {dinner.meal && dinner.meal.tags.length > 0 ? (
              <p className="text-muted-foreground mt-1 text-xs">{dinner.meal.tags.join(' · ')}</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground self-start"
            aria-label={`Clear ${weekdayName(night.date)}’s dinner`}
            onClick={actions.onClearDinner}
          >
            <X />
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm italic">
          {night.options.length > 0 ? 'Not decided yet' : 'Nothing planned yet'}
        </p>
      )}

      {night.options.length > 0 ? (
        <div className="mt-3">
          <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
            Options
          </h3>
          <ul className="-mx-2 space-y-0.5">
            {night.options.map((option) => (
              <OptionRow
                key={option.id}
                option={option}
                me={me}
                members={members}
                onVote={(vote) => actions.onVote(option.id, vote)}
                onChoose={() => actions.onChoose(option.id)}
                onRemove={() => actions.onRemoveOption(option.id)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {suggestion !== undefined ? (
        <div
          className="border-primary/30 bg-primary/5 mt-3 rounded-lg border border-dashed p-3"
          role="status"
        >
          {suggestion ? (
            <div className="flex flex-wrap items-center gap-3">
              <MealThumb path={suggestion.meal.coverPhotoPath} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="text-muted-foreground text-xs">How about…</p>
                <p className="truncate font-semibold">{suggestion.meal.name}</p>
                <p className="text-muted-foreground text-xs">
                  Last had {lastEaten(suggestion.lastEatenOn, today)}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" onClick={actions.onUseSuggestion}>
                  Plan it
                </Button>
                <Button size="sm" variant="outline" onClick={actions.onProposeSuggestion}>
                  Add as option
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Another suggestion"
                  onClick={actions.onShuffle}
                >
                  <Shuffle />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Close suggestion"
                  onClick={actions.onDismissSuggestion}
                >
                  <X />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">
                No more ideas: every meal is already in this week.
              </span>
              <Button size="sm" variant="ghost" onClick={actions.onDismissSuggestion}>
                Close
              </Button>
            </div>
          )}
        </div>
      ) : null}

      <div className="-mx-2 mt-3 flex flex-wrap gap-0.5 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={actions.onPlan}
          aria-label={`${dinner ? 'Change' : 'Plan'} ${weekdayName(night.date)}’s dinner`}
        >
          <UtensilsCrossed />
          {dinner ? 'Change' : 'Plan'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={actions.onAddOptions}
          aria-label={`Add options for ${weekdayName(night.date)}`}
        >
          <ListPlus />
          Options
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={actions.onShuffle}
          aria-label={`Shuffle a meal for ${weekdayName(night.date)}`}
        >
          <Sparkles />
          Shuffle
        </Button>
      </div>
    </section>
  );
}
