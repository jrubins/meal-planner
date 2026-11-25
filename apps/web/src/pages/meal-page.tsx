import { useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { cn } from 'cn';
import { ArrowLeft, Camera, ExternalLink, Pencil, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { PhotoKind } from '@app/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { householdQueryOptions } from '@/features/household/queries';
import { MealForm } from '@/features/meals/meal-form';
import { MealThumb } from '@/features/meals/meal-thumb';
import {
  mealQueryOptions,
  useDeleteMeal,
  useDeletePhoto,
  useRereadPhoto,
  useUpdateMeal,
  useUploadPhoto,
} from '@/features/meals/queries';
import { RecipeEditor } from '@/features/meals/recipe-editor';
import { RecipeSection } from '@/features/meals/recipe-section';
import { apiUrl } from '@/lib/api';
import { lastEaten, monthDay } from '@/lib/format';
import { resizeImage } from '@/lib/resize-image';

export function MealPage({ mealId }: { mealId: number }) {
  const { data: meal } = useSuspenseQuery(mealQueryOptions(mealId));
  const { data: household } = useSuspenseQuery(householdQueryOptions);
  const updateMeal = useUpdateMeal(mealId);
  const deleteMeal = useDeleteMeal();
  const uploadPhoto = useUploadPhoto(mealId);
  const deletePhoto = useDeletePhoto(mealId);
  const rereadPhoto = useRereadPhoto(mealId);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const dishPhotos = meal.photos.filter((photo) => photo.kind === 'meal');
  const recipePhotos = meal.photos.filter((photo) => photo.kind === 'recipe');
  const selected = dishPhotos.find((p) => p.id === selectedPhotoId) ?? dishPhotos[0];

  async function upload(files: File[], kind: PhotoKind) {
    setUploadError(null);
    try {
      // One at a time, in the order chosen: recipe pages are read in that order.
      for (const file of files) {
        await uploadPhoto.mutateAsync({ photo: await resizeImage(file), kind });
      }
    } catch {
      setUploadError('That photo couldn’t be added. Try a JPEG or PNG.');
    }
  }

  return (
    <div className="space-y-5">
      <Link
        to="/meals"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All meals
      </Link>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs">
        {selected ? (
          <div className="relative">
            <img
              src={apiUrl(selected.path)}
              alt={meal.name}
              className="bg-muted aspect-[4/3] w-full object-cover sm:aspect-[16/9]"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 opacity-90"
              aria-label="Delete this photo"
              disabled={deletePhoto.isPending}
              onClick={() => {
                setSelectedPhotoId(null);
                deletePhoto.mutate(selected.id);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="bg-secondary text-muted-foreground hover:text-foreground flex aspect-[16/9] w-full flex-col items-center justify-center gap-2"
          >
            <Camera className="size-8" strokeWidth={1.5} aria-hidden />
            <span className="text-sm">Add a photo of the dish</span>
          </button>
        )}
        {dishPhotos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto p-2">
            {dishPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                aria-label="Show photo"
                aria-pressed={photo.id === selected?.id}
                onClick={() => setSelectedPhotoId(photo.id)}
                className={cn(
                  'shrink-0 rounded-lg ring-offset-2 outline-none',
                  photo.id === selected?.id && 'ring-primary ring-2',
                )}
              >
                <MealThumb path={photo.path} className="size-14" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="bg-secondary text-muted-foreground hover:text-foreground flex size-14 shrink-0 items-center justify-center rounded-lg"
              aria-label="Add photos"
            >
              <Camera className="size-5" aria-hidden />
            </button>
          </div>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label="Upload photos of the dish"
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []), 'meal');
            event.target.value = '';
          }}
        />
      </div>
      {uploadPhoto.isPending ? (
        <p role="status" className="text-muted-foreground text-sm">
          Uploading…
        </p>
      ) : null}
      {uploadError ? (
        <p role="alert" className="text-destructive text-sm">
          {uploadError}
        </p>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">{meal.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {meal.timesEaten === 0
              ? 'Not had yet'
              : `Had ${meal.timesEaten === 1 ? 'once' : `${meal.timesEaten} times`}, last ${lastEaten(meal.lastEatenOn, household.today)}${meal.lastEatenOn ? ` (${monthDay(meal.lastEatenOn)})` : ''}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete meal"
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {meal.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {meal.tags.map((tag) => (
            <li key={tag} className="bg-secondary rounded-full px-3 py-1 text-xs">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {meal.description ? (
        <p className="leading-relaxed whitespace-pre-line">{meal.description}</p>
      ) : null}

      {meal.recipeUrl ? (
        <a
          href={meal.recipeUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-primary inline-flex items-center gap-1.5 font-medium hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden />
          Open the recipe link
        </a>
      ) : null}

      <RecipeSection
        recipe={meal.recipe}
        photos={recipePhotos}
        uploading={uploadPhoto.isPending}
        onAddPhotos={(files) => void upload(files, 'recipe')}
        onReread={(photoId) => rereadPhoto.mutate(photoId)}
        onDeletePhoto={(photoId) => deletePhoto.mutate(photoId)}
        onEdit={() => setEditingRecipe(true)}
      />

      <Dialog open={editingRecipe} onOpenChange={setEditingRecipe}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{meal.recipe ? 'Edit recipe' : 'Add recipe'}</DialogTitle>
            <DialogDescription>Empty rows are left out when you save.</DialogDescription>
          </DialogHeader>
          <RecipeEditor
            recipe={meal.recipe}
            onCancel={() => setEditingRecipe(false)}
            onSave={async (recipe) => {
              await updateMeal.mutateAsync({ recipe });
              setEditingRecipe(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit meal</DialogTitle>
            <DialogDescription>Changes show everywhere this meal is planned.</DialogDescription>
          </DialogHeader>
          <MealForm
            meal={meal}
            onCancel={() => setEditing(false)}
            onSubmit={async (values) => {
              await updateMeal.mutateAsync(values);
              setEditing(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {meal.name}?</DialogTitle>
            <DialogDescription>
              Its photos and options go too. Nights it was planned for keep their notes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
              <X />
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMeal.isPending}
              onClick={() => {
                void deleteMeal.mutateAsync(meal.id).then(() => navigate({ to: '/meals' }));
              }}
            >
              <Trash2 />
              Delete meal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
