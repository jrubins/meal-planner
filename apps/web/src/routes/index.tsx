import { CalendarDateSchema } from '@app/shared';
import { createFileRoute } from '@tanstack/react-router';
import { householdQueryOptions } from '@/features/household/queries';
import { mealsQueryOptions } from '@/features/meals/queries';
import { weekQueryOptions } from '@/features/plan/queries';
import { WeekPage } from '@/pages/week-page';

export const Route = createFileRoute('/')({
  // ?week=YYYY-MM-DD shows the week containing that date; without it, this week.
  validateSearch: (search: Record<string, unknown>): { week?: string } => {
    const week = CalendarDateSchema.safeParse(search['week']);
    return week.success ? { week: week.data } : {};
  },
  loaderDeps: ({ search }) => ({ week: search.week }),
  loader: async ({ context, deps }) => {
    void context.queryClient.prefetchQuery(mealsQueryOptions);
    await Promise.all([
      context.queryClient.ensureQueryData(weekQueryOptions(deps.week)),
      context.queryClient.ensureQueryData(householdQueryOptions),
    ]);
  },
  component: function WeekRoute() {
    return <WeekPage date={Route.useSearch().week} />;
  },
});
