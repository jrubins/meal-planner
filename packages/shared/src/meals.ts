import { z } from 'zod';
import { CalendarDateSchema } from './dates.ts';

/** Image types photos may be uploaded as (the web app converts to JPEG before upload). */
export const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PhotoContentTypeSchema = z.enum(PHOTO_CONTENT_TYPES);
export type PhotoContentType = z.infer<typeof PhotoContentTypeSchema>;
/** Largest photo upload, in bytes. Under Vercel Functions' 4.5 MB request limit. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const MealPhotoSchema = z.object({
  id: z.number().int(),
  /** API path that serves the image, e.g. /meals/3/photos/7. */
  path: z.string(),
  createdAt: z.iso.datetime(),
});
export type MealPhoto = z.infer<typeof MealPhotoSchema>;

/** A meal as plans show it: enough to render a card. */
export const MealSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  tags: z.string().array(),
  /** API path of the first photo, or null. */
  coverPhotoPath: z.string().nullable(),
});
export type MealSummary = z.infer<typeof MealSummarySchema>;

export const MealSchema = MealSummarySchema.extend({
  description: z.string().nullable(),
  recipeUrl: z.string().nullable(),
  photos: MealPhotoSchema.array(),
  /** The most recent night (up to today) this meal was the dinner, or null. */
  lastEatenOn: CalendarDateSchema.nullable(),
  /** Nights (up to today) this meal was the dinner. */
  timesEaten: z.number().int(),
  createdAt: z.iso.datetime(),
});
export type Meal = z.infer<typeof MealSchema>;

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(10)
  .transform((list) => [...new Set(list)])
  .describe('Short lowercase labels, e.g. "quick", "vegetarian", "pasta"');

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

const recipeUrl = z
  .union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Enter a web address' })])
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const CreateMealSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: optionalText(2000).optional().describe('Notes: ingredients, how to make it, sides'),
  recipeUrl: recipeUrl.optional().describe('Link to the recipe'),
  tags: tags.optional(),
});
export type CreateMeal = z.infer<typeof CreateMealSchema>;
export type CreateMealInput = z.input<typeof CreateMealSchema>;

export const UpdateMealSchema = CreateMealSchema.partial();
export type UpdateMeal = z.infer<typeof UpdateMealSchema>;

export const MealIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const MealPhotoParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  photoId: z.coerce.number().int().positive(),
});

export const ListMealsQuerySchema = z.object({
  q: z.string().trim().max(100).optional().describe('Matches meal names, descriptions and tags'),
  tag: z.string().trim().toLowerCase().max(30).optional().describe('Only meals with this tag'),
});
export type ListMealsQuery = z.infer<typeof ListMealsQuerySchema>;

export const SuggestionSchema = z.object({
  meal: MealSummarySchema,
  lastEatenOn: CalendarDateSchema.nullable(),
  timesEaten: z.number().int(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const SuggestMealsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(20).default(3).describe('How many meals to suggest'),
  date: CalendarDateSchema.optional().describe(
    'Skip meals already planned (or proposed) in the week containing this date. Default: today',
  ),
  exclude: z
    .union([z.coerce.number().int().positive(), z.coerce.number().int().positive().array()])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional()
    .describe('Meal IDs not to suggest (e.g. ones just rejected)'),
});
export type SuggestMealsQuery = z.infer<typeof SuggestMealsQuerySchema>;
