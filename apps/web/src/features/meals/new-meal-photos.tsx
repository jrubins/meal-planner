import { Camera, FileText, Sparkles, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Photos chosen while creating a meal; uploaded (or generated) once the meal is saved. */
export interface NewMealPhotos {
  meal: File[];
  recipe: File[];
  /** Make a picture with AI when there's no photo of the dish. */
  generate: boolean;
}

interface NewMealPhotosFieldProps {
  value: NewMealPhotos;
  onChange: (value: NewMealPhotos) => void;
}

/**
 * The photo part of the new-meal form: photos of the dish (or, without any, a picture made
 * with AI) and photos of the recipe, which are read into the recipe once the meal is saved.
 */
export function NewMealPhotosField({ value, onChange }: NewMealPhotosFieldProps) {
  const generateId = useId();
  return (
    <div className="space-y-4">
      <PhotoPicker
        label="Photos of the dish"
        icon={<Camera />}
        files={value.meal}
        onChange={(meal) => onChange({ ...value, meal })}
      />
      {value.meal.length === 0 ? (
        <div className="bg-secondary/60 flex items-start gap-2.5 rounded-lg p-3">
          <input
            id={generateId}
            type="checkbox"
            aria-describedby={`${generateId}-hint`}
            className="accent-primary mt-0.5 size-4 shrink-0"
            checked={value.generate}
            onChange={(event) => onChange({ ...value, generate: event.target.checked })}
          />
          <div className="space-y-0.5 text-sm">
            <label htmlFor={generateId} className="flex items-center gap-1.5 font-medium">
              <Sparkles className="text-primary size-3.5" aria-hidden />
              No photo? Generate one with AI
            </label>
            <p id={`${generateId}-hint`} className="text-muted-foreground">
              Made from the name, notes and recipe, in about 20 seconds.
            </p>
          </div>
        </div>
      ) : null}
      <PhotoPicker
        label="Photos of the recipe"
        hint="Read into the recipe automatically."
        icon={<FileText />}
        files={value.recipe}
        onChange={(recipe) => onChange({ ...value, recipe })}
      />
    </div>
  );
}

function PhotoPicker({
  label,
  hint,
  icon,
  files,
  onChange,
}: {
  label: string;
  hint?: string;
  icon: ReactNode;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
          {icon}
          {files.length > 0 ? 'Add more' : 'Add'}
        </Button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label={`Choose ${label.toLowerCase()}`}
          onChange={(event) => {
            onChange([...files, ...Array.from(event.target.files ?? [])]);
            event.target.value = '';
          }}
        />
      </div>
      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {files.map((file, index) => (
            <li key={previews[index]} className="relative">
              <img
                src={previews[index]}
                alt={file.name}
                className="bg-muted size-16 rounded-lg object-cover"
              />
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="bg-background/90 text-foreground absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border shadow-xs"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
