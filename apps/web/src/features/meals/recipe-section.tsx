import type { MealPhoto, Recipe, RecipeReadStatus } from '@app/shared';
import { cn } from 'cn';
import { Check, FileText, LoaderCircle, RotateCw, Trash2, TriangleAlert } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api';
import { RecipeCard, type RecipeCardProps } from './recipe-card';

interface RecipeSectionProps extends Pick<
  RecipeCardProps,
  'onToggleIngredient' | 'onAdjustSteps' | 'adjusting' | 'adjustError'
> {
  /** The recipe, or null when there is none yet. */
  recipe: Recipe | null;
  /** The meal's recipe photos (photos of the dish are shown elsewhere). */
  photos: MealPhoto[];
  uploading: boolean;
  onAddPhotos: (files: File[]) => void;
  onReread: (photoId: number) => void;
  onDeletePhoto: (photoId: number) => void;
  onEdit: () => void;
}

const STATUS: Record<RecipeReadStatus, { label: string; icon: ReactNode; tone: string }> = {
  reading: {
    label: 'Reading the recipe…',
    icon: <LoaderCircle className="size-3.5 animate-spin" aria-hidden />,
    tone: 'text-muted-foreground',
  },
  done: {
    label: 'Added to the recipe',
    icon: <Check className="size-3.5" aria-hidden />,
    tone: 'text-vote-up',
  },
  not_a_recipe: {
    label: 'No recipe found in this photo',
    icon: <TriangleAlert className="size-3.5" aria-hidden />,
    tone: 'text-muted-foreground',
  },
  failed: {
    label: 'Couldn’t read this photo',
    icon: <TriangleAlert className="size-3.5" aria-hidden />,
    tone: 'text-destructive',
  },
  unavailable: {
    label: 'Recipe reading isn’t set up',
    icon: <TriangleAlert className="size-3.5" aria-hidden />,
    tone: 'text-muted-foreground',
  },
};

/**
 * A meal's recipe: its text, and the photos of the recipe it was read from. Adding a recipe
 * photo has Claude read it, and the text is added to the recipe when that finishes.
 */
export function RecipeSection({
  recipe,
  photos,
  uploading,
  onAddPhotos,
  onReread,
  onDeletePhoto,
  onEdit,
  ...cardProps
}: RecipeSectionProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = photos.some((photo) => photo.readStatus === 'reading');

  return (
    <section aria-labelledby="recipe-heading" className="bg-card space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 id="recipe-heading" className="text-lg font-semibold">
          Recipe
        </h2>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {recipe ? 'Edit' : 'Type it in'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <FileText />
            {uploading ? 'Uploading…' : 'Add recipe photo'}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Upload recipe photos"
          onChange={(event) => {
            onAddPhotos(Array.from(event.target.files ?? []));
            event.target.value = '';
          }}
        />
      </div>

      {recipe ? (
        <RecipeCard recipe={recipe} {...cardProps} />
      ) : (
        <p className="text-muted-foreground text-sm">
          {reading
            ? 'Reading your recipe photo. The recipe appears here in a moment.'
            : 'Snap the cookbook page or recipe card and the recipe is typed up here, ready for you and Claude to read.'}
        </p>
      )}

      {photos.length > 0 ? (
        <ul className="space-y-2" aria-label="Recipe photos">
          {photos.map((photo, index) => {
            const status = STATUS[photo.readStatus ?? 'unavailable'];
            return (
              <li key={photo.id} className="flex items-center gap-3">
                <a
                  href={apiUrl(photo.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                  aria-label={`Open recipe photo ${index + 1}`}
                >
                  <img
                    src={apiUrl(photo.path)}
                    alt=""
                    loading="lazy"
                    className="bg-muted size-12 rounded-md object-cover"
                  />
                </a>
                <p className={cn('flex flex-1 items-center gap-1.5 text-sm', status.tone)}>
                  {status.icon}
                  {status.label}
                </p>
                {photo.readStatus === 'failed' ? (
                  <Button variant="ghost" size="sm" onClick={() => onReread(photo.id)}>
                    <RotateCw />
                    Try again
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground size-8"
                  aria-label={`Delete recipe photo ${index + 1}`}
                  onClick={() => onDeletePhoto(photo.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
