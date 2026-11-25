import type { HouseholdMember, Night, Suggestion, VoteValue } from '@app/shared';
import { cn } from 'cn';
import { ListPlus, NotebookPen, Shuffle, Sparkles, UtensilsCrossed, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MealThumb } from '@/features/meals/meal-thumb';
import { lastHad, monthDay, weekdayName } from '@/lib/format';
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

/**
 * One night of the week: its dinner, the options being voted on, and ways to plan it.
 *
 * It lays itself out by its own width (a container query), not the screen's. As a full-width
 * row (desktop) it's three columns: the day, what's planned, and the actions, so the week
 * reads as an agenda whose rows line up however much each night holds. At phone width it
 * stacks, with the actions along the bottom; very narrow, it goes compact (photo on top,
 * icon-only actions).
 */
export function NightCard({ night, today, me, members, suggestion, ...actions }: NightCardProps) {
  const isToday = night.date === today;
  const isPast = night.date < today;
  const dinner = night.dinner;
  const headingId = `night-${night.date}`;

  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'bg-card @container rounded-xl border p-4 shadow-xs',
        isToday && 'border-primary/50 ring-primary/15 ring-4',
        isPast && !isToday && 'opacity-75',
      )}
    >
      <div className="flex h-full flex-col gap-3 @3xl:grid @3xl:grid-cols-[8rem_minmax(0,1fr)_auto] @3xl:items-start @3xl:gap-x-6">
        <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 @3xl:flex-col @3xl:items-start @3xl:gap-y-0.5">
          <h2 id={headingId} className="text-lg font-semibold">
            {weekdayName(night.date)}
          </h2>
          <span className="text-muted-foreground text-sm">{monthDay(night.date)}</span>
          {isToday ? (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              Tonight
            </span>
          ) : null}
          {dinner ? (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground -my-1 -mr-2 ml-auto size-8 self-center @3xl:hidden"
              title="Clear"
              aria-label={`Clear ${weekdayName(night.date)}’s dinner`}
              onClick={actions.onClearDinner}
            >
              <X />
            </Button>
          ) : null}
        </header>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {dinner ? (
            <div className="flex flex-col gap-3 @xs:flex-row @xs:items-center @xs:gap-4">
              {dinner.meal ? (
                <MealThumb
                  path={dinner.meal.coverPhotoPath}
                  className="aspect-[4/3] w-full @xs:aspect-auto @xs:size-20 @3xl:size-16"
                />
              ) : (
                // A night with only a note ("eating out"): a note icon where the photo goes,
                // so rows still line up. Very narrow cards skip it.
                <div
                  aria-hidden
                  className="bg-secondary text-muted-foreground hidden size-20 shrink-0 items-center justify-center rounded-lg @xs:flex @3xl:size-16"
                >
                  <NotebookPen className="size-6" strokeWidth={1.5} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {dinner.meal ? (
                  <p className="line-clamp-3 text-base leading-snug font-semibold @xs:line-clamp-2 @xs:text-lg @md:text-xl">
                    {dinner.meal.name}
                  </p>
                ) : null}
                {dinner.note ? (
                  <p
                    className={cn(
                      dinner.meal
                        ? 'text-muted-foreground text-sm'
                        : 'text-base font-semibold @xs:text-lg @md:text-xl',
                    )}
                  >
                    {dinner.note}
                  </p>
                ) : null}
                {dinner.meal && dinner.meal.tags.length > 0 ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {dinner.meal.tags.join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
          ) : night.options.length > 0 ? (
            <p className="text-muted-foreground text-sm">
              <span className="italic">Not decided yet</span> ·{' '}
              {night.options.length === 1
                ? '1 option to vote on'
                : `${night.options.length} options to vote on`}
            </p>
          ) : (
            // In a board row this panel fills the card's spare height, so an empty night reads
            // as deliberately empty rather than as a short card.
            <p className="text-muted-foreground flex min-h-16 flex-1 items-center justify-center rounded-lg border border-dashed px-2 text-center text-sm italic @xs:min-h-0 @xs:flex-none @xs:justify-start @xs:border-0 @xs:px-0 @xs:text-left">
              Nothing planned yet
            </p>
          )}

          {night.options.length > 0 ? (
            <div>
              {/* Without a dinner, the line above already introduces them. */}
              {dinner ? (
                <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                  Options
                </h3>
              ) : (
                <h3 className="sr-only">Options</h3>
              )}
              <ul className="-mx-2 space-y-0.5 @3xl:max-w-lg">
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
              className="border-primary/30 bg-primary/5 rounded-lg border border-dashed p-3"
              role="status"
            >
              {suggestion ? (
                <div className="flex flex-wrap items-center gap-3">
                  <MealThumb path={suggestion.meal.coverPhotoPath} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-xs">How about…</p>
                    <p className="truncate font-semibold">{suggestion.meal.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {lastHad(suggestion.lastEatenOn, today)}
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
        </div>

        <div className="-mx-2 mt-auto flex flex-wrap gap-0.5 border-t pt-2 @3xl:-my-1 @3xl:mx-0 @3xl:flex-nowrap @3xl:border-0 @3xl:pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.onPlan}
            title={dinner ? 'Change' : 'Plan'}
            aria-label={`${dinner ? 'Change' : 'Plan'} ${weekdayName(night.date)}’s dinner`}
          >
            <UtensilsCrossed />
            <span className="hidden @xs:inline">{dinner ? 'Change' : 'Plan'}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.onAddOptions}
            title="Options"
            aria-label={`Add options for ${weekdayName(night.date)}`}
          >
            <ListPlus />
            <span className="hidden @xs:inline">Options</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={actions.onShuffle}
            title="Shuffle"
            aria-label={`Shuffle a meal for ${weekdayName(night.date)}`}
          >
            <Sparkles />
            <span className="hidden @xs:inline">Shuffle</span>
          </Button>
          {dinner ? (
            <Button
              variant="ghost"
              size="sm"
              // Labelled beside the other actions in a row; on a stacked card it's the ✕ in
              // the card's top-right corner instead.
              className="text-muted-foreground hidden @3xl:inline-flex"
              onClick={actions.onClearDinner}
              title="Clear"
              aria-label={`Clear ${weekdayName(night.date)}’s dinner`}
            >
              <X />
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
