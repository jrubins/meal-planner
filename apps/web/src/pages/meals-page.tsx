import type { Suggestion } from '@app/shared';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { Plus, Search, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { householdQueryOptions } from '@/features/household/queries';
import { MealCard } from '@/features/meals/meal-card';
import { MealForm } from '@/features/meals/meal-form';
import { MealThumb } from '@/features/meals/meal-thumb';
import { fetchSuggestions, mealsQueryOptions, useCreateMeal } from '@/features/meals/queries';
import { lastHad } from '@/lib/format';

export function MealsPage() {
  const { data: meals } = useSuspenseQuery(mealsQueryOptions);
  const { data: household } = useSuspenseQuery(householdQueryOptions);
  const createMeal = useCreateMeal();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [surprise, setSurprise] = useState<Suggestion | null>(null);

  const tags = [...new Set(meals.flatMap((meal) => meal.tags))].sort();
  const needle = query.trim().toLowerCase();
  const shown = meals.filter(
    (meal) =>
      (!tag || meal.tags.includes(tag)) &&
      (!needle ||
        [meal.name, meal.description ?? '', ...meal.tags].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );

  async function surpriseMe() {
    const [pick] = await fetchSuggestions(household.today, 1, surprise ? [surprise.meal.id] : []);
    setSurprise(pick ?? null);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Meals</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {meals.length === 1 ? '1 meal' : `${meals.length} meals`} in your library
          </p>
        </div>
        <div className="flex gap-2">
          {meals.length > 0 ? (
            <Button variant="outline" onClick={() => void surpriseMe()}>
              <Sparkles />
              Surprise me
            </Button>
          ) : null}
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New meal
          </Button>
        </div>
      </div>

      {surprise ? (
        <div
          role="status"
          className="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border border-dashed p-3"
        >
          <MealThumb path={surprise.meal.coverPhotoPath} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs">How about…</p>
            <Link
              to="/meals/$mealId"
              params={{ mealId: surprise.meal.id }}
              className="font-semibold hover:underline"
            >
              {surprise.meal.name}
            </Link>
            <p className="text-muted-foreground text-xs">
              {lastHad(surprise.lastEatenOn, household.today)}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void surpriseMe()}>
            Another
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close suggestion"
            onClick={() => setSurprise(null)}
          >
            <X />
          </Button>
        </div>
      ) : null}

      {meals.length > 0 ? (
        <div className="space-y-3">
          <div className="relative">
            <Label htmlFor="meal-search" className="sr-only">
              Search meals
            </Label>
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              id="meal-search"
              placeholder="Search meals"
              className="bg-card pl-8"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by tag">
              {tags.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={tag === name}
                  onClick={() => setTag(tag === name ? null : name)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    tag === name
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {meals.length === 0 ? (
        <div className="bg-card rounded-xl border border-dashed p-8 text-center">
          <p className="font-medium">No meals yet</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Add the dinners you make, or ask Claude to add them for you.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">No meals match.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Meals">
          {shown.map((meal) => (
            <li key={meal.id}>
              <MealCard meal={meal} today={household.today} />
            </li>
          ))}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New meal</DialogTitle>
            <DialogDescription>You can add photos once it’s saved.</DialogDescription>
          </DialogHeader>
          <MealForm
            submitLabel="Add meal"
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              const meal = await createMeal.mutateAsync(values);
              setCreating(false);
              await navigate({ to: '/meals/$mealId', params: { mealId: meal.id } });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
