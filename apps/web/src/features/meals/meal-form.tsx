import { CreateMealSchema, type CreateMeal, type Meal } from '@app/shared';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NewMealPhotosField, type NewMealPhotos } from './new-meal-photos';

/**
 * The form edits plain strings (tags as one comma-separated line); the shared schema checks
 * each field, so the messages match the API's.
 */
const field = (name: keyof typeof CreateMealSchema.shape) =>
  z.string().superRefine((value, ctx) => {
    const result = CreateMealSchema.shape[name].safeParse(value);
    if (!result.success)
      ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? 'Invalid' });
  });
const MealFormSchema = z.object({
  name: field('name'),
  description: field('description'),
  recipeUrl: field('recipeUrl'),
  tags: z.string().max(400),
});

const NO_PHOTOS: NewMealPhotos = { meal: [], recipe: [], generate: false };

const toTags = (text: string) =>
  text
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

interface MealFormProps {
  /** The meal being edited; a new meal without one. */
  meal?: Meal;
  submitLabel?: string;
  /** New meals only: also choose photos of the dish and the recipe, passed to onSubmit. */
  withPhotos?: boolean;
  onSubmit: (values: CreateMeal, photos: NewMealPhotos) => Promise<unknown>;
  onCancel?: () => void;
}

/** Create or edit a meal. Validates with the same Zod schema the API uses. */
export function MealForm({
  meal,
  submitLabel = 'Save',
  withPhotos = false,
  onSubmit,
  onCancel,
}: MealFormProps) {
  const [photos, setPhotos] = useState(NO_PHOTOS);
  const form = useForm({
    defaultValues: {
      name: meal?.name ?? '',
      description: meal?.description ?? '',
      recipeUrl: meal?.recipeUrl ?? '',
      tags: meal?.tags.join(', ') ?? '',
    },
    validators: { onSubmit: MealFormSchema },
    onSubmit: async ({ value }) => {
      await onSubmit(CreateMealSchema.parse({ ...value, tags: toTags(value.tags) }), photos);
    },
  });

  const fields = [
    { name: 'name', label: 'Name', placeholder: 'e.g. Chicken tikka masala' },
    { name: 'tags', label: 'Tags', placeholder: 'quick, vegetarian, pasta' },
    { name: 'recipeUrl', label: 'Recipe link', placeholder: 'https://…' },
  ] as const;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {fields.map(({ name, label, placeholder }) => (
        <form.Field key={name} name={name}>
          {(field) => {
            const error = field.state.meta.errors[0]?.message;
            return (
              <div className="space-y-1.5">
                <Label htmlFor={`meal-${name}`}>{label}</Label>
                <Input
                  id={`meal-${name}`}
                  name={name}
                  type={name === 'recipeUrl' ? 'url' : 'text'}
                  placeholder={placeholder}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `meal-${name}-error` : undefined}
                />
                {error ? (
                  <p id={`meal-${name}-error`} className="text-destructive text-sm">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          }}
        </form.Field>
      ))}
      <form.Field name="description">
        {(field) => (
          <div className="space-y-1.5">
            <Label htmlFor="meal-description">Notes</Label>
            <Textarea
              id="meal-description"
              name="description"
              rows={4}
              placeholder="Ingredients, sides, how we like it…"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </div>
        )}
      </form.Field>
      {withPhotos ? <NewMealPhotosField value={photos} onChange={setPhotos} /> : null}
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : submitLabel}
            </Button>
          )}
        </form.Subscribe>
      </div>
    </form>
  );
}
