import { cn } from 'cn';
import { CookingPot } from 'lucide-react';
import { apiUrl } from '@/lib/api';

interface MealThumbProps {
  /** API path of the photo, or null for a placeholder. */
  path: string | null;
  className?: string;
}

/** A meal's cover photo, or a placeholder. Decorative: the meal's name is always beside it. */
export function MealThumb({ path, className }: MealThumbProps) {
  if (path) {
    return (
      <img
        src={apiUrl(path)}
        alt=""
        loading="lazy"
        className={cn('bg-muted shrink-0 rounded-lg object-cover', className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'bg-secondary text-muted-foreground/60 flex shrink-0 items-center justify-center rounded-lg',
        className,
      )}
    >
      <CookingPot className="size-1/2 max-h-8 max-w-8" strokeWidth={1.5} />
    </div>
  );
}
