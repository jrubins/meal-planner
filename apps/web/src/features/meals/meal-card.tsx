import type { Meal } from '@app/shared';
import { Link } from '@tanstack/react-router';
import { lastHad } from '@/lib/format';
import { MealThumb } from './meal-thumb';

interface MealCardProps {
  meal: Meal;
  today: string;
}

/** A meal in the library grid: photo, name, tags and when it was last eaten. */
export function MealCard({ meal, today }: MealCardProps) {
  return (
    <Link
      to="/meals/$mealId"
      params={{ mealId: meal.id }}
      className="group bg-card focus-visible:ring-ring/50 block overflow-hidden rounded-xl border shadow-xs outline-none focus-visible:ring-[3px]"
    >
      <MealThumb
        path={meal.coverPhotoPath}
        className="aspect-[4/3] w-full rounded-none transition-transform group-hover:scale-[1.02]"
      />
      <div className="space-y-0.5 p-3">
        <p className="line-clamp-2 leading-snug font-semibold">{meal.name}</p>
        <p className="text-muted-foreground text-xs">{lastHad(meal.lastEatenOn, today)}</p>
        {meal.tags.length > 0 ? (
          <p className="text-muted-foreground truncate text-xs">{meal.tags.join(' · ')}</p>
        ) : null}
      </div>
    </Link>
  );
}
