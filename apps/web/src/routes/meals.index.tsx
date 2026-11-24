import { createFileRoute } from '@tanstack/react-router';
import { householdQueryOptions } from '@/features/household/queries';
import { mealsQueryOptions } from '@/features/meals/queries';
import { MealsPage } from '@/pages/meals-page';

export const Route = createFileRoute('/meals/')({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(mealsQueryOptions),
      context.queryClient.ensureQueryData(householdQueryOptions),
    ]),
  component: MealsPage,
});
