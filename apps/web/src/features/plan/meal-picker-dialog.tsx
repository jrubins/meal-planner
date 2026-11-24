import type { Meal } from '@app/shared';
import { cn } from 'cn';
import { Check, Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MealThumb } from '@/features/meals/meal-thumb';
import { lastEaten } from '@/lib/format';

export type PickerMode = 'dinner' | 'options';

interface MealPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: PickerMode;
  /** e.g. "Tuesday, Nov 24" */
  nightLabel: string;
  meals: Meal[];
  today: string;
  /** Meals already proposed for the night (shown as already added in options mode). */
  proposedMealIds?: readonly number[];
  /** Dinner mode: plan this meal. */
  onPickMeal: (mealId: number) => Promise<unknown>;
  /** Dinner mode: plan the night with just a note. */
  onPickNote: (note: string) => Promise<unknown>;
  /** Options mode: propose these meals. */
  onProposeMeals: (mealIds: number[]) => Promise<unknown>;
  /** Creates a meal from the search text, returning it. */
  onCreateMeal: (name: string) => Promise<Meal>;
}

/** Choose a meal for a night (or a note), or several meals to vote on. */
export function MealPickerDialog({
  open,
  onOpenChange,
  mode,
  nightLabel,
  meals,
  today,
  proposedMealIds = [],
  onPickMeal,
  onPickNote,
  onProposeMeals,
  onCreateMeal,
}: MealPickerDialogProps) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const searchId = useId();
  const noteId = useId();

  const needle = query.trim().toLowerCase();
  const shown = meals.filter(
    (meal) =>
      !needle ||
      meal.name.toLowerCase().includes(needle) ||
      meal.tags.some((tag) => tag.includes(needle)),
  );
  const exactMatch = meals.some((meal) => meal.name.toLowerCase() === needle);

  const close = () => {
    onOpenChange(false);
    setQuery('');
    setSelected([]);
    setNote('');
  };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      close();
    } finally {
      setBusy(false);
    }
  }

  async function createFromQuery() {
    setBusy(true);
    try {
      const meal = await onCreateMeal(query.trim());
      if (mode === 'dinner') {
        await onPickMeal(meal.id);
        close();
      } else {
        setSelected((ids) => [...ids, meal.id]);
        setQuery('');
      }
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: number) =>
    setSelected((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === 'dinner' ? 'Plan dinner' : 'Add options'}</DialogTitle>
          <DialogDescription>
            {mode === 'dinner'
              ? `What’s for dinner on ${nightLabel}?`
              : `Pick a few meals for ${nightLabel} to vote on.`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Label htmlFor={searchId} className="sr-only">
            Search meals
          </Label>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            id={searchId}
            placeholder="Search meals"
            className="pl-8"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <ul className="-mx-2 min-h-0 flex-1 overflow-y-auto" aria-label="Meals">
          {shown.map((meal) => {
            const proposed = proposedMealIds.includes(meal.id);
            const isSelected = selected.includes(meal.id);
            return (
              <li key={meal.id}>
                <button
                  type="button"
                  disabled={busy || (mode === 'options' && proposed)}
                  aria-pressed={mode === 'options' ? isSelected : undefined}
                  onClick={() =>
                    mode === 'dinner' ? void run(() => onPickMeal(meal.id)) : toggle(meal.id)
                  }
                  className={cn(
                    'hover:bg-secondary flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left disabled:opacity-50',
                    isSelected && 'bg-accent text-accent-foreground hover:bg-accent',
                  )}
                >
                  <MealThumb path={meal.coverPhotoPath} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{meal.name}</span>
                    <span className="text-muted-foreground block text-xs">
                      {proposed ? 'Already an option' : `Last had ${lastEaten(meal.lastEatenOn, today)}`}
                    </span>
                  </span>
                  {isSelected ? <Check className="size-4" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && !needle ? (
            <li className="text-muted-foreground px-2 py-4 text-sm">
              No meals yet. Type a name to add one.
            </li>
          ) : null}
        </ul>

        {needle && !exactMatch ? (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void createFromQuery()}
            className="justify-start"
          >
            <Plus />
            Add “{query.trim()}” as a new meal
          </Button>
        ) : null}

        {mode === 'dinner' ? (
          <form
            className="flex items-end gap-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim()) void run(() => onPickNote(note.trim()));
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor={noteId} className="text-muted-foreground text-xs">
                Or just a note
              </Label>
              <Input
                id={noteId}
                placeholder="Eating out, leftovers…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !note.trim()}>
              Save note
            </Button>
          </form>
        ) : (
          <DialogFooter>
            <Button
              disabled={busy || selected.length === 0}
              onClick={() => void run(() => onProposeMeals(selected))}
            >
              {selected.length > 1 ? `Add ${selected.length} options` : 'Add option'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
