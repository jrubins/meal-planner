import {
  HouseholdSchema,
  type JoinHousehold,
  type UpdateHousehold,
  type UpdateMember,
} from '@app/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export const householdQueryOptions = queryOptions({
  queryKey: ['household'],
  queryFn: () => apiRequest('/household', HouseholdSchema),
});

function useHouseholdMutation<T>(path: string, method: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) =>
      apiRequest(path, HouseholdSchema, { method, body: JSON.stringify(input ?? {}) }),
    onSuccess: (household) => {
      queryClient.setQueryData(householdQueryOptions.queryKey, household);
      // Members' names show on votes; joining changes every meal and plan.
      void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'household' });
    },
  });
}

export const useUpdateHousehold = () => useHouseholdMutation<UpdateHousehold>('/household', 'PATCH');
export const useUpdateMe = () => useHouseholdMutation<UpdateMember>('/household/me', 'PATCH');
export const useJoinHousehold = () => useHouseholdMutation<JoinHousehold>('/household/join', 'POST');
export const useNewInviteCode = () =>
  useHouseholdMutation<undefined>('/household/invite-code', 'POST');
