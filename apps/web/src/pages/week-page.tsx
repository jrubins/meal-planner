import { addDays, type Suggestion } from '@app/shared';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { householdQueryOptions } from '@/features/household/queries';
import { fetchSuggestions, mealsQueryOptions, useCreateMeal } from '@/features/meals/queries';
import { MealPickerDialog, type PickerMode } from '@/features/plan/meal-picker-dialog';
import { NightCard } from '@/features/plan/night-card';
import {
  useAddOptions,
  useChooseOption,
  useClearDinner,
  useRemoveOption,
  useSetDinner,
  useShuffleWeek,
  useVote,
  weekQueryOptions,
} from '@/features/plan/queries';
import { ApiRequestError } from '@/lib/api';
import { monthDay, weekdayName, weekRange } from '@/lib/format';

interface WeekPageProps {
  /** Any date in the week to show; this week when undefined. */
  date: string | undefined;
}

/** Shuffled suggestion per night, and the meals already shown there (so "another" differs). */
type Shuffles = Record<string, { suggestion: Suggestion | null; seen: number[] }>;

export function WeekPage({ date }: WeekPageProps) {
  const { data: week } = useSuspenseQuery(weekQueryOptions(date));
  const { data: household } = useSuspenseQuery(householdQueryOptions);
  const meals = useQuery(mealsQueryOptions);
  const [picker, setPicker] = useState<{ date: string; mode: PickerMode } | null>(null);
  const [shuffles, setShuffles] = useState<Shuffles>({});
  const [notice, setNotice] = useState<string | null>(null);

  const setDinner = useSetDinner();
  const clearDinner = useClearDinner();
  const addOptions = useAddOptions();
  const removeOption = useRemoveOption();
  const vote = useVote();
  const choose = useChooseOption();
  const shuffleWeek = useShuffleWeek();
  const createMeal = useCreateMeal();

  const isThisWeek = week.start <= week.today && week.today <= week.end;
  const planned = week.nights.filter((n) => n.dinner).length;
  const emptyNights = week.nights.filter((n) => !n.dinner && n.options.length === 0).length;
  const pickerNight = week.nights.find((n) => n.date === picker?.date);

  async function shuffle(night: string) {
    const seen = shuffles[night]?.seen ?? [];
    const [suggestion] = await fetchSuggestions(night, 1, seen);
    setShuffles((all) => ({
      ...all,
      [night]: {
        suggestion: suggestion ?? null,
        seen: suggestion ? [...seen, suggestion.meal.id] : seen,
      },
    }));
  }

  const dismiss = (night: string) =>
    setShuffles((all) => Object.fromEntries(Object.entries(all).filter(([d]) => d !== night)));

  async function fillEmptyNights() {
    setNotice(null);
    try {
      const { added } = await shuffleWeek.mutateAsync({ date: week.start, optionsPerNight: 2 });
      setNotice(
        added.length > 0
          ? `Added ${added.length} options to vote on.`
          : 'Every night already has a plan or options.',
      );
    } catch (error) {
      if (error instanceof ApiRequestError && error.code === 'no_meals') {
        setNotice('Add a few meals first, then shuffle.');
      } else {
        throw error;
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{weekRange(week.start, week.end)}</p>
          <h1 className="text-3xl font-semibold">
            {isThisWeek ? 'This week' : 'Week of ' + monthDay(week.start)}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{planned} of 7 dinners planned</p>
        </div>
        <nav aria-label="Weeks" className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild>
            <Link to="/" search={{ week: addDays(week.start, -7) }} aria-label="Previous week">
              <ChevronLeft />
            </Link>
          </Button>
          {!isThisWeek ? (
            <Button variant="outline" asChild>
              <Link to="/" search={{}}>
                This week
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="icon" asChild>
            <Link to="/" search={{ week: addDays(week.start, 7) }} aria-label="Next week">
              <ChevronRight />
            </Link>
          </Button>
        </nav>
      </div>

      {emptyNights > 0 ? (
        <div className="bg-secondary/70 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3">
          <p className="text-sm">
            {emptyNights === 1 ? '1 night has' : `${emptyNights} nights have`} nothing planned. Need
            some inspiration?
          </p>
          <Button size="sm" disabled={shuffleWeek.isPending} onClick={() => void fillEmptyNights()}>
            <Sparkles />
            Fill empty nights
          </Button>
        </div>
      ) : null}
      {notice ? (
        <p role="status" className="text-muted-foreground text-sm">
          {notice}
        </p>
      ) : null}

      <div className="space-y-3">
        {week.nights.map((night) => (
          <NightCard
            key={night.date}
            night={night}
            today={week.today}
            me={household.me}
            members={week.members}
            suggestion={shuffles[night.date]?.suggestion}
            onPlan={() => setPicker({ date: night.date, mode: 'dinner' })}
            onAddOptions={() => setPicker({ date: night.date, mode: 'options' })}
            onShuffle={() => void shuffle(night.date)}
            onClearDinner={() => clearDinner.mutate(night.date)}
            onVote={(optionId, value) => vote.mutate({ optionId, vote: value })}
            onChoose={(optionId) => choose.mutate(optionId)}
            onRemoveOption={(optionId) => removeOption.mutate(optionId)}
            onUseSuggestion={() => {
              const mealId = shuffles[night.date]?.suggestion?.meal.id;
              if (mealId) setDinner.mutate({ date: night.date, mealId, note: null });
              dismiss(night.date);
            }}
            onProposeSuggestion={() => {
              const mealId = shuffles[night.date]?.suggestion?.meal.id;
              if (mealId) addOptions.mutate({ date: night.date, mealIds: [mealId] });
              dismiss(night.date);
            }}
            onDismissSuggestion={() => dismiss(night.date)}
          />
        ))}
      </div>

      {picker ? (
        <MealPickerDialog
          open
          onOpenChange={(open) => (open ? undefined : setPicker(null))}
          mode={picker.mode}
          nightLabel={`${weekdayName(picker.date)}, ${monthDay(picker.date)}`}
          meals={meals.data ?? []}
          today={week.today}
          proposedMealIds={pickerNight?.options.map((o) => o.meal.id)}
          onPickMeal={(mealId) =>
            setDinner.mutateAsync({
              date: picker.date,
              mealId,
              note: pickerNight?.dinner?.note ?? null,
            })
          }
          onPickNote={(note) => setDinner.mutateAsync({ date: picker.date, mealId: null, note })}
          onProposeMeals={(mealIds) => addOptions.mutateAsync({ date: picker.date, mealIds })}
          onCreateMeal={(name) => createMeal.mutateAsync({ name })}
        />
      ) : null}
    </div>
  );
}
