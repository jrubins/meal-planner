import {
  MealPhotoSchema,
  MealSchema,
  type PhotoKind,
  SuggestionSchema,
  type CreateMeal,
  type UpdateMeal,
} from '@app/shared';
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export const mealsQueryOptions = queryOptions({
  queryKey: ['meals'],
  queryFn: () => apiRequest('/meals', MealSchema.array()),
});

export const mealQueryOptions = (id: number) =>
  queryOptions({
    queryKey: ['meals', id],
    queryFn: () => apiRequest(`/meals/${id}`, MealSchema),
    // While a recipe photo is being read, check back until its text arrives.
    refetchInterval: (query) =>
      query.state.data?.photos.some((photo) => photo.readStatus === 'reading') ? 2000 : false,
  });

/** Random meals for inspiration, skipping ones already in the week of `date`. */
export function fetchSuggestions(date: string, count: number, exclude: readonly number[] = []) {
  const params = new URLSearchParams({ date, count: String(count) });
  for (const id of exclude) params.append('exclude', String(id));
  return apiRequest(`/meals/suggestions?${params.toString()}`, SuggestionSchema.array());
}

/** Meals and plans both show meal details, so any meal change refreshes both. */
function useInvalidateMeals() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['meals'] }),
      queryClient.invalidateQueries({ queryKey: ['week'] }),
    ]);
}

export function useCreateMeal() {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: (input: CreateMeal) =>
      apiRequest('/meals', MealSchema, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useUpdateMeal(id: number) {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: (input: UpdateMeal) =>
      apiRequest(`/meals/${id}`, MealSchema, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useDeleteMeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest(`/meals/${id}`, null, { method: 'DELETE' }),
    // Refresh everything except the deleted meal itself, which no longer exists to fetch.
    onSuccess: (_, id) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['meals'],
          predicate: (query) => query.queryKey[1] !== id,
        }),
        queryClient.invalidateQueries({ queryKey: ['week'] }),
      ]),
  });
}

export function useUploadPhoto(mealId: number) {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: ({ photo, kind }: { photo: Blob; kind: PhotoKind }) =>
      apiRequest(`/meals/${mealId}/photos?kind=${kind}`, MealPhotoSchema, {
        method: 'POST',
        headers: { 'content-type': photo.type },
        body: photo,
      }),
    onSuccess: invalidate,
  });
}

/** Rewrites the recipe's steps to leave out its excluded ingredients. */
export function useAdjustSteps(mealId: number) {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: () => apiRequest(`/meals/${mealId}/recipe/adjust`, MealSchema, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

/** Reads a recipe photo again (after a failed reading). */
export function useRereadPhoto(mealId: number) {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: (photoId: number) =>
      apiRequest(`/meals/${mealId}/photos/${photoId}/read`, MealPhotoSchema, { method: 'POST' }),
    onSuccess: invalidate,
  });
}

export function useDeletePhoto(mealId: number) {
  const invalidate = useInvalidateMeals();
  return useMutation({
    mutationFn: (photoId: number) =>
      apiRequest(`/meals/${mealId}/photos/${photoId}`, null, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
