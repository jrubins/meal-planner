import { RecipeInputSchema, type Recipe } from '@app/shared';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** What the form edits: every field a string, so inputs stay controlled. */
interface Draft {
  title: string;
  servings: string;
  prepTime: string;
  cookTime: string;
  ingredients: { key: number; section: string; amount: string; item: string; note: string }[];
  steps: { key: number; text: string }[];
  notes: string;
}

let nextKey = 0;
const key = () => nextKey++;

function toDraft(recipe: Recipe | null): Draft {
  return {
    title: recipe?.title ?? '',
    servings: recipe?.servings ?? '',
    prepTime: recipe?.prepTime ?? '',
    cookTime: recipe?.cookTime ?? '',
    ingredients: (recipe?.ingredients ?? []).map((i) => ({
      key: key(),
      section: i.section ?? '',
      amount: i.amount ?? '',
      item: i.item,
      note: i.note ?? '',
    })),
    steps: (recipe?.steps ?? []).map((text) => ({ key: key(), text })),
    notes: recipe?.notes ?? '',
  };
}

/** Moves item `index` one place up (-1) or down (+1). */
function move<T>(list: T[], index: number, by: -1 | 1): T[] {
  const target = index + by;
  if (target < 0 || target >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(index, 1);
  if (item !== undefined) copy.splice(target, 0, item);
  return copy;
}

interface RecipeEditorProps {
  recipe: Recipe | null;
  onSave: (recipe: Recipe) => Promise<unknown>;
  onCancel: () => void;
}

/**
 * Edits a recipe: title, servings and times, ingredient rows, step rows and notes. Blank
 * rows are dropped on save; the shared schema validates what's left, as the API does.
 */
export function RecipeEditor({ recipe, onSave, onCancel }: RecipeEditorProps) {
  const [draft, setDraft] = useState(() => toDraft(recipe));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [field]: value }));
  const setIngredient = (
    index: number,
    field: 'section' | 'amount' | 'item' | 'note',
    value: string,
  ) =>
    set(
      'ingredients',
      draft.ingredients.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = RecipeInputSchema.safeParse({
      ...draft,
      ingredients: draft.ingredients
        .filter((row) => row.item.trim() || row.amount.trim() || row.note.trim())
        .map((row) => ({
          section: row.section,
          amount: row.amount,
          item: row.item,
          note: row.note,
        })),
      steps: draft.steps.map((step) => step.text).filter((text) => text.trim()),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the recipe');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(parsed.data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="recipe-title">Title</Label>
          <Input
            id="recipe-title"
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="recipe-servings">Servings</Label>
          <Input
            id="recipe-servings"
            placeholder="4"
            value={draft.servings}
            onChange={(e) => set('servings', e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="recipe-prep">Prep</Label>
            <Input
              id="recipe-prep"
              placeholder="20 min"
              value={draft.prepTime}
              onChange={(e) => set('prepTime', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-cook">Cook</Label>
            <Input
              id="recipe-cook"
              placeholder="40 min"
              value={draft.cookTime}
              onChange={(e) => set('cookTime', e.target.value)}
            />
          </div>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Ingredients</legend>
        {draft.ingredients.map((row, index) => (
          <div key={row.key} className="bg-secondary/50 space-y-2 rounded-lg p-2">
            <div className="flex gap-2">
              <Input
                aria-label={`Ingredient ${index + 1} amount`}
                placeholder="Amount"
                className="w-24 shrink-0"
                value={row.amount}
                onChange={(e) => setIngredient(index, 'amount', e.target.value)}
              />
              <Input
                aria-label={`Ingredient ${index + 1}`}
                placeholder="Ingredient"
                value={row.item}
                onChange={(e) => setIngredient(index, 'item', e.target.value)}
              />
            </div>
            <Input
              aria-label={`Ingredient ${index + 1} note`}
              placeholder="Note (e.g. finely chopped)"
              value={row.note}
              onChange={(e) => setIngredient(index, 'note', e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                aria-label={`Ingredient ${index + 1} section`}
                placeholder="Section (e.g. Sauce)"
                value={row.section}
                onChange={(e) => setIngredient(index, 'section', e.target.value)}
              />
              <RowActions
                label={`ingredient ${index + 1}`}
                first={index === 0}
                last={index === draft.ingredients.length - 1}
                onMove={(by) => set('ingredients', move(draft.ingredients, index, by))}
                onRemove={() =>
                  set(
                    'ingredients',
                    draft.ingredients.filter((_, i) => i !== index),
                  )
                }
              />
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            set('ingredients', [
              ...draft.ingredients,
              // A new row continues the section of the one before it.
              {
                key: key(),
                section: draft.ingredients.at(-1)?.section ?? '',
                amount: '',
                item: '',
                note: '',
              },
            ])
          }
        >
          <Plus />
          Add ingredient
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Steps</legend>
        {draft.steps.map((step, index) => (
          <div key={step.key} className="flex items-start gap-2">
            <span
              className="text-muted-foreground w-5 pt-2 text-right text-sm tabular-nums"
              aria-hidden
            >
              {index + 1}
            </span>
            <Textarea
              aria-label={`Step ${index + 1}`}
              rows={2}
              value={step.text}
              onChange={(e) =>
                set(
                  'steps',
                  draft.steps.map((s, i) => (i === index ? { ...s, text: e.target.value } : s)),
                )
              }
            />
            <RowActions
              label={`step ${index + 1}`}
              first={index === 0}
              last={index === draft.steps.length - 1}
              onMove={(by) => set('steps', move(draft.steps, index, by))}
              onRemove={() =>
                set(
                  'steps',
                  draft.steps.filter((_, i) => i !== index),
                )
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set('steps', [...draft.steps, { key: key(), text: '' }])}
        >
          <Plus />
          Add step
        </Button>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="recipe-notes">Notes</Label>
        <Textarea
          id="recipe-notes"
          rows={3}
          placeholder="Tips, variations, how it keeps…"
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </Button>
      </div>
    </form>
  );
}

function RowActions({
  label,
  first,
  last,
  onMove,
  onRemove,
}: {
  label: string;
  first: boolean;
  last: boolean;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`Move ${label} up`}
        disabled={first}
        onClick={() => onMove(-1)}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9"
        aria-label={`Move ${label} down`}
        disabled={last}
        onClick={() => onMove(1)}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground size-9"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}
