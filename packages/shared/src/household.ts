import { z } from 'zod';
import { CalendarDateSchema, WeekStartsOnSchema } from './dates.ts';

// A household is the people who plan dinners together. Every user belongs to exactly one,
// created for them on first use; a partner joins it with its invite code.

export const HouseholdMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
});
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>;

export const HouseholdSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  inviteCode: z.string(),
  timeZone: z.string(),
  weekStartsOn: WeekStartsOnSchema,
  /** Today in the household's time zone. */
  today: CalendarDateSchema,
  members: HouseholdMemberSchema.array(),
  /** The acting user's own user ID. */
  me: z.string(),
});
export type Household = z.infer<typeof HouseholdSchema>;

export const UpdateHouseholdSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100).optional(),
  timeZone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .optional()
    .describe('IANA time zone, e.g. "America/New_York"'),
  weekStartsOn: WeekStartsOnSchema.optional().describe('0 = Sunday, 1 = Monday'),
});
export type UpdateHousehold = z.infer<typeof UpdateHouseholdSchema>;

export const UpdateMemberSchema = z.object({
  displayName: z.string().trim().min(1, 'Name is required').max(50),
});
export type UpdateMember = z.infer<typeof UpdateMemberSchema>;

export const JoinHouseholdSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Invite code is required')
    .max(20)
    .describe('The invite code shown on the other household’s Household page'),
});
export type JoinHousehold = z.infer<typeof JoinHouseholdSchema>;
