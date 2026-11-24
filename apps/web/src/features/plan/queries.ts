import {
  NightSchema,
  ShuffleWeekResultSchema,
  WeekSchema,
  type SetDinner,
  type Vote,
} from '@app/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

/** The week containing `date`, or this week (in the household's time zone) without one. */
export const weekQueryOptions = (date?: string) =>
  queryOptions({
    queryKey: ['week', date ?? 'current'],
    queryFn: () => apiRequest(`/plan/weeks/${date ?? 'current'}`, WeekSchema),
  });

/** Every plan change can affect any week view (and meals' "last eaten"), so refresh them. */
function usePlanMutation<T>(request: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['week'] }),
        queryClient.invalidateQueries({ queryKey: ['meals'] }),
      ]),
  });
}

export const useSetDinner = () =>
  usePlanMutation(({ date, ...input }: SetDinner & { date: string }) =>
    apiRequest(`/plan/nights/${date}/dinner`, NightSchema, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  );

export const useClearDinner = () =>
  usePlanMutation((date: string) =>
    apiRequest(`/plan/nights/${date}/dinner`, NightSchema, { method: 'DELETE' }),
  );

export const useAddOptions = () =>
  usePlanMutation((input: { date: string; mealIds: number[] }) =>
    apiRequest('/plan/options', NightSchema, { method: 'POST', body: JSON.stringify(input) }),
  );

export const useRemoveOption = () =>
  usePlanMutation((id: number) =>
    apiRequest(`/plan/options/${id}`, NightSchema, { method: 'DELETE' }),
  );

export const useVote = () =>
  usePlanMutation(({ optionId, vote }: Vote & { optionId: number }) =>
    apiRequest(`/plan/options/${optionId}/vote`, NightSchema, {
      method: 'PUT',
      body: JSON.stringify({ vote }),
    }),
  );

export const useChooseOption = () =>
  usePlanMutation((optionId: number) =>
    apiRequest(`/plan/options/${optionId}/choose`, NightSchema, { method: 'POST' }),
  );

export const useShuffleWeek = () =>
  usePlanMutation((input: { date: string; optionsPerNight: number }) =>
    apiRequest(`/plan/weeks/${input.date}/shuffle`, ShuffleWeekResultSchema, {
      method: 'POST',
      body: JSON.stringify({ optionsPerNight: input.optionsPerNight }),
    }),
  );
