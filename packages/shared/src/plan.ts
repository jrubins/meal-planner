import { z } from 'zod';
import { CalendarDateSchema } from './dates.ts';
import { HouseholdMemberSchema } from './household.ts';
import { MealSummarySchema } from './meals.ts';

// The weekly plan: one chosen dinner per night, plus options proposed for a night that each
// member votes on with a thumbs up or down.

export const VoteValueSchema = z.enum(['up', 'down']);
export type VoteValue = z.infer<typeof VoteValueSchema>;

export const OptionVoteSchema = z.object({
  userId: z.string(),
  value: VoteValueSchema,
});
export type OptionVote = z.infer<typeof OptionVoteSchema>;

export const DinnerOptionSchema = z.object({
  id: z.number().int(),
  date: CalendarDateSchema,
  meal: MealSummarySchema,
  proposedByUserId: z.string(),
  votes: OptionVoteSchema.array(),
  /** True when this option's meal is the night's chosen dinner. */
  chosen: z.boolean(),
});
export type DinnerOption = z.infer<typeof DinnerOptionSchema>;

export const DinnerSchema = z.object({
  date: CalendarDateSchema,
  meal: MealSummarySchema.nullable(),
  note: z.string().nullable(),
});
export type Dinner = z.infer<typeof DinnerSchema>;

export const NightSchema = z.object({
  date: CalendarDateSchema,
  /** The chosen dinner, or null when nothing is planned. */
  dinner: DinnerSchema.nullable(),
  options: DinnerOptionSchema.array(),
});
export type Night = z.infer<typeof NightSchema>;

export const WeekSchema = z.object({
  start: CalendarDateSchema,
  end: CalendarDateSchema,
  today: CalendarDateSchema,
  nights: NightSchema.array(),
  members: HouseholdMemberSchema.array(),
});
export type Week = z.infer<typeof WeekSchema>;

export const DateParamsSchema = z.object({
  date: CalendarDateSchema.describe('A night, as YYYY-MM-DD'),
});

export const OptionIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const note = z
  .string()
  .trim()
  .max(200)
  .transform((value) => (value === '' ? null : value))
  .nullable();

export const SetDinnerSchema = z
  .object({
    mealId: z.number().int().positive().nullable().optional(),
    note: note.optional().describe('Free text, e.g. "eating out" or "leftovers"'),
  })
  .refine((value) => value.mealId != null || value.note != null, {
    message: 'Choose a meal or write a note',
  });
export type SetDinner = z.infer<typeof SetDinnerSchema>;

export const AddOptionsSchema = z.object({
  date: CalendarDateSchema,
  mealIds: z.number().int().positive().array().min(1).max(10),
});
export type AddOptions = z.infer<typeof AddOptionsSchema>;

export const VoteSchema = z.object({
  vote: z.enum(['up', 'down', 'none']).describe('"none" removes your vote'),
});
export type Vote = z.infer<typeof VoteSchema>;

export const ShuffleWeekSchema = z.object({
  optionsPerNight: z
    .number()
    .int()
    .min(1)
    .max(5)
    .default(2)
    .describe('How many suggested options to add to each night'),
});
export type ShuffleWeek = z.infer<typeof ShuffleWeekSchema>;

export const ShuffleWeekResultSchema = z.object({
  week: WeekSchema,
  /** Options added, for nights that had no dinner and no options. */
  added: DinnerOptionSchema.array(),
});
export type ShuffleWeekResult = z.infer<typeof ShuffleWeekResultSchema>;
