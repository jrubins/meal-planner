import { createFileRoute } from '@tanstack/react-router';
import { householdQueryOptions } from '@/features/household/queries';
import { mealQueryOptions } from '@/features/meals/queries';
import { MealPage } from '@/pages/meal-page';

export const Route = createFileRoute('/meals/$mealId')({
  params: {
    parse: ({ mealId }) => ({ mealId: Number(mealId) }),
    stringify: ({ mealId }) => ({ mealId: String(mealId) }),
  },
  loader: ({ context, params }) =>
    Promise.all([
      context.queryClient.ensureQueryData(mealQueryOptions(params.mealId)),
      context.queryClient.ensureQueryData(householdQueryOptions),
    ]),
  component: function MealRoute() {
    return <MealPage mealId={Route.useParams().mealId} />;
  },
});
