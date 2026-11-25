import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { Plus, Search } from 'lucide-react';
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
import type { NewMealPhotos } from '@/features/meals/new-meal-photos';
import {
  mealsQueryOptions,
  uploadPhoto,
  useCreateMeal,
  useGeneratePhoto,
} from '@/features/meals/queries';
import { resizeImage } from '@/lib/resize-image';

export function MealsPage() {
  const { data: meals } = useSuspenseQuery(mealsQueryOptions);
  const { data: household } = useSuspenseQuery(householdQueryOptions);
  const createMeal = useCreateMeal();
  const generatePhoto = useGeneratePhoto();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  /** A new meal whose photos didn't all upload: the dialog says so before opening it. */
  const [partlySaved, setPartlySaved] = useState<{ mealId: number; failed: number } | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  /**
   * Saves a new meal, then its photos (dish first, then recipe pages in the order chosen, so
   * they're read in that order), then starts a generated picture if asked for one. The
   * meal's page shows the picture being made.
   */
  async function addMeal(
    values: Parameters<typeof createMeal.mutateAsync>[0],
    photos: NewMealPhotos,
  ) {
    const meal = await createMeal.mutateAsync(values);
    let failed = 0;
    for (const [kind, files] of [
      ['meal', photos.meal],
      ['recipe', photos.recipe],
    ] as const) {
      for (const file of files) {
        try {
          await uploadPhoto(meal.id, await resizeImage(file), kind);
        } catch {
          failed += 1;
        }
      }
    }
    if (photos.meal.length + photos.recipe.length > 0) {
      await queryClient.invalidateQueries({ queryKey: ['meals'] });
    }
    if (photos.generate && photos.meal.length === 0) generatePhoto.mutate(meal.id);
    if (failed > 0) {
      setPartlySaved({ mealId: meal.id, failed });
      return;
    }
    setCreating(false);
    await navigate({ to: '/meals/$mealId', params: { mealId: meal.id } });
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
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New meal
          </Button>
        </div>
      </div>

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
        <ul
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          aria-label="Meals"
        >
          {shown.map((meal) => (
            <li key={meal.id}>
              <MealCard meal={meal} today={household.today} />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={creating}
        onOpenChange={(open) => {
          setCreating(open);
          if (!open) setPartlySaved(null);
        }}
      >
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New meal</DialogTitle>
            <DialogDescription>
              {partlySaved
                ? 'The meal is saved.'
                : 'Add photos now or later. Recipe photos are read into the recipe.'}
            </DialogDescription>
          </DialogHeader>
          {partlySaved ? (
            <div className="space-y-4">
              <p role="alert" className="text-sm">
                {partlySaved.failed === 1
                  ? '1 photo couldn’t be added.'
                  : `${partlySaved.failed} photos couldn’t be added.`}{' '}
                Try adding {partlySaved.failed === 1 ? 'it' : 'them'} again from the meal’s page, as
                JPEG or PNG.
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setCreating(false);
                    setPartlySaved(null);
                    void navigate({
                      to: '/meals/$mealId',
                      params: { mealId: partlySaved.mealId },
                    });
                  }}
                >
                  Open the meal
                </Button>
              </div>
            </div>
          ) : (
            <MealForm
              submitLabel="Add meal"
              withPhotos
              onCancel={() => setCreating(false)}
              onSubmit={addMeal}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
