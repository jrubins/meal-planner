import {
  CalendarDateSchema,
  CreateMealSchema,
  HouseholdSchema,
  ListMealsQuerySchema,
  MealSchema,
  NightSchema,
  ShuffleWeekResultSchema,
  SuggestionSchema,
  UpdateHouseholdSchema,
  UpdateMealSchema,
  UpdateMemberSchema,
  VoteSchema,
  WeekSchema,
} from '@app/shared';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { notFound } from '../../lib/http-error.ts';
import type { HouseholdService } from '../household/household.service.ts';
import type { MealsService } from '../meals/meals.service.ts';
import type { PlanService } from '../plan/plan.service.ts';

export interface McpServices {
  households: HouseholdService;
  meals: MealsService;
  plan: PlanService;
}

const INSTRUCTIONS = `Dinner planner for a household (usually a couple) who plan the week's dinners together.

- Each night has at most one chosen dinner: a meal from the household's library, a note ("eating out", "leftovers"), or both.
- Anyone can propose several meals as options for a night; each member votes thumbs up or down on each option, and choosing an option makes it that night's dinner.
- Dates are calendar dates (YYYY-MM-DD) in the household's time zone. Call get_household or get_week first to learn today's date and the week's dates; never guess them.
- Meals can be referred to by mealId or by exact name (mealName, case-insensitive). A meal must exist before it is planned: if a name is not found, offer to create it with create_meal.
- For inspiration, suggest_meals favours meals not eaten recently and skips ones already in the week; shuffle_week adds suggested options to every empty night for the household to vote on.
- A meal can carry its recipe, structured: title, servings, prep and cook times, ingredients (section, amount as written, item, note, excluded), steps and notes. Ingredients marked excluded are ones this household always leaves out: leave them off shopping lists. When adjustedSteps is set and its leftOut matches the excluded ingredients, those are the steps they cook from; adjust_recipe_steps rewrites them after exclusions change. It is read automatically from recipe photos uploaded in the web app, or set with create_meal / update_meal. Use get_meal to answer questions about ingredients or steps, and to build shopping lists for the week. Keep amounts as written ("2 tbsp", "a pinch").
- Photos (of the dish or of its recipe) are added in the web app, not here.`;

const mealRef = {
  mealId: z.number().int().positive().optional().describe('The meal’s ID'),
  mealName: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('The meal’s exact name, as an alternative to mealId'),
};

const json = <T extends object>(output: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(output) }],
  structuredContent: output,
});

/**
 * The tools an MCP client (e.g. Claude) can call, all acting as `userId`. A fresh server is
 * built per request (stateless Streamable HTTP), so the user is fixed for its lifetime.
 * Tool inputs reuse the shared Zod schemas, exactly like the REST API.
 */
export function createMcpServer(services: McpServices, userId: string): McpServer {
  const { households, meals, plan } = services;
  const server = new McpServer(
    { name: 'meal-planner', version: '1.0.0' },
    { instructions: INSTRUCTIONS },
  );

  async function resolveMeal(ref: { mealId?: number; mealName?: string }): Promise<number> {
    if (ref.mealId !== undefined) return ref.mealId;
    if (ref.mealName === undefined) throw notFound('Give a mealId or a mealName');
    const meal = await meals.findByName(userId, ref.mealName);
    if (!meal) {
      throw notFound(
        `No meal is named "${ref.mealName}". Check list_meals, or create it with create_meal.`,
      );
    }
    return meal.id;
  }

  // --- Household --------------------------------------------------------------------------

  server.registerTool(
    'get_household',
    {
      title: 'Get household',
      description:
        "The user's household: its members, time zone, today's date, which day weeks start on, and the invite code a partner uses to join.",
      outputSchema: HouseholdSchema,
      annotations: { readOnlyHint: true },
    },
    async () => json(await households.get(userId)),
  );

  server.registerTool(
    'update_household',
    {
      title: 'Update household',
      description: "Change the household's name, time zone or first day of the week.",
      inputSchema: UpdateHouseholdSchema,
      outputSchema: HouseholdSchema,
    },
    async (input) => json(await households.update(userId, input)),
  );

  server.registerTool(
    'set_my_name',
    {
      title: 'Set my name',
      description: 'Set the name the household sees for the signed-in user (e.g. on votes).',
      inputSchema: UpdateMemberSchema,
      outputSchema: HouseholdSchema,
    },
    async (input) => json(await households.updateMe(userId, input)),
  );

  // --- The plan ---------------------------------------------------------------------------

  server.registerTool(
    'get_week',
    {
      title: 'Get week plan',
      description:
        'The dinner plan for the week containing a date (default: this week): each night’s chosen dinner, and the options proposed for it with every member’s votes.',
      inputSchema: z.object({
        date: CalendarDateSchema.optional().describe('Any date in the week. Default: today'),
      }),
      outputSchema: WeekSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ date }) => json(await plan.week(userId, date)),
  );

  server.registerTool(
    'plan_dinner',
    {
      title: 'Plan dinner',
      description:
        'Set the chosen dinner for a night, replacing any earlier choice: a meal (by mealId or mealName), a note such as "eating out", or both.',
      inputSchema: z.object({
        date: CalendarDateSchema,
        ...mealRef,
        note: z.string().trim().max(200).optional().describe('e.g. "eating out", "leftovers"'),
      }),
      outputSchema: NightSchema,
    },
    async ({ date, note, ...ref }) => {
      const mealId =
        ref.mealId !== undefined || ref.mealName !== undefined ? await resolveMeal(ref) : null;
      if (mealId === null && !note) throw notFound('Give a meal or a note for the night');
      return json(await plan.setDinner(userId, date, { mealId, note: note || null }));
    },
  );

  server.registerTool(
    'clear_dinner',
    {
      title: 'Clear dinner',
      description: 'Remove the chosen dinner for a night. Its proposed options stay.',
      inputSchema: z.object({ date: CalendarDateSchema }),
      outputSchema: NightSchema,
      annotations: { destructiveHint: true },
    },
    async ({ date }) => json(await plan.clearDinner(userId, date)),
  );

  server.registerTool(
    'propose_options',
    {
      title: 'Propose options',
      description:
        'Propose meals as options for a night, for the household to vote on. Give mealIds or mealNames (or both). Meals already proposed for that night are kept as they are.',
      inputSchema: z.object({
        date: CalendarDateSchema,
        mealIds: z.number().int().positive().array().max(10).optional(),
        mealNames: z.string().trim().min(1).max(100).array().max(10).optional(),
      }),
      outputSchema: NightSchema,
    },
    async ({ date, mealIds = [], mealNames = [] }) => {
      const resolved = [
        ...mealIds,
        ...(await Promise.all(mealNames.map((mealName) => resolveMeal({ mealName })))),
      ];
      if (resolved.length === 0) throw notFound('Give at least one meal to propose');
      return json(await plan.addOptions(userId, { date, mealIds: resolved }));
    },
  );

  server.registerTool(
    'remove_option',
    {
      title: 'Remove option',
      description: 'Withdraw an option proposed for a night (and its votes).',
      inputSchema: z.object({ optionId: z.number().int().positive() }),
      outputSchema: NightSchema,
      annotations: { destructiveHint: true },
    },
    async ({ optionId }) => json(await plan.removeOption(userId, optionId)),
  );

  server.registerTool(
    'vote_on_option',
    {
      title: 'Vote on option',
      description:
        'Vote on an option as the signed-in user: "up" (thumbs up), "down" (thumbs down) or "none" to take the vote back.',
      inputSchema: z.object({ optionId: z.number().int().positive(), ...VoteSchema.shape }),
      outputSchema: NightSchema,
    },
    async ({ optionId, vote }) => json(await plan.vote(userId, optionId, { vote })),
  );

  server.registerTool(
    'choose_option',
    {
      title: 'Choose option',
      description:
        "Make an option's meal the night's dinner. The other options stay listed, so the choice can change later.",
      inputSchema: z.object({ optionId: z.number().int().positive() }),
      outputSchema: NightSchema,
    },
    async ({ optionId }) => json(await plan.chooseOption(userId, optionId)),
  );

  server.registerTool(
    'suggest_meals',
    {
      title: 'Suggest meals',
      description:
        "Random meals from the household's library for inspiration, favouring ones not eaten for a while and skipping any already planned or proposed in the week. Each comes with when it was last eaten.",
      inputSchema: z.object({
        count: z.number().int().min(1).max(20).default(3),
        date: CalendarDateSchema.optional().describe(
          'Skip meals already in the week containing this date. Default: this week',
        ),
        excludeMealIds: z
          .number()
          .int()
          .positive()
          .array()
          .max(100)
          .optional()
          .describe('Meals not to suggest, e.g. ones just turned down'),
      }),
      outputSchema: z.object({ suggestions: SuggestionSchema.array() }),
      annotations: { readOnlyHint: true },
    },
    async ({ count, date, excludeMealIds }) =>
      json({
        suggestions: await plan.suggest(userId, { count, date, exclude: excludeMealIds }),
      }),
  );

  server.registerTool(
    'shuffle_week',
    {
      title: 'Shuffle week',
      description:
        'Add suggested meals as options to every night of a week that has no dinner and no options yet, for the household to vote on.',
      inputSchema: z.object({
        date: CalendarDateSchema.optional().describe('Any date in the week. Default: this week'),
        optionsPerNight: z.number().int().min(1).max(5).default(2),
      }),
      outputSchema: ShuffleWeekResultSchema,
    },
    async ({ date, optionsPerNight }) =>
      json(await plan.shuffleWeek(userId, date, optionsPerNight)),
  );

  // --- Meals ------------------------------------------------------------------------------

  server.registerTool(
    'list_meals',
    {
      title: 'List meals',
      description:
        "The household's meal library, alphabetical, with tags, notes, recipe links and when each was last eaten. Optionally search (q) or filter by tag.",
      inputSchema: ListMealsQuerySchema,
      outputSchema: z.object({ meals: MealSchema.array() }),
      annotations: { readOnlyHint: true },
    },
    async (query) => json({ meals: await meals.list(userId, query) }),
  );

  server.registerTool(
    'get_meal',
    {
      title: 'Get meal',
      description:
        'One meal by mealId or mealName, with its notes, recipe link, recipe (ingredients and steps) and history.',
      inputSchema: z.object(mealRef),
      outputSchema: MealSchema,
      annotations: { readOnlyHint: true },
    },
    async (ref) => json(await meals.get(userId, await resolveMeal(ref))),
  );

  server.registerTool(
    'create_meal',
    {
      title: 'Create meal',
      description:
        "Add a meal to the household's library. Check list_meals first so the same meal isn't added twice.",
      inputSchema: CreateMealSchema,
      outputSchema: MealSchema,
    },
    async (input) => json(await meals.create(userId, input)),
  );

  server.registerTool(
    'update_meal',
    {
      title: 'Update meal',
      description:
        'Change a meal’s name, notes, recipe link, recipe or tags. Only the fields given change; tags replaces the whole list, and recipe replaces the whole recipe (send the full recipe, changed where needed, or null to remove it).',
      inputSchema: z.object({ mealId: z.number().int().positive(), ...UpdateMealSchema.shape }),
      outputSchema: MealSchema,
    },
    async ({ mealId, ...input }) => json(await meals.update(userId, mealId, input)),
  );

  server.registerTool(
    'adjust_recipe_steps',
    {
      title: 'Adjust recipe steps',
      description:
        "Rewrite a meal's recipe steps to leave out its excluded ingredients (mark them excluded with update_meal first). The original steps are kept; the adjusted ones are stored in recipe.adjustedSteps.",
      inputSchema: z.object({ mealId: z.number().int().positive() }),
      outputSchema: MealSchema,
    },
    async ({ mealId }) => json(await meals.adjustSteps(userId, mealId)),
  );

  server.registerTool(
    'delete_meal',
    {
      title: 'Delete meal',
      description:
        'Delete a meal from the library, with its photos and options. Nights it was planned for keep their notes but lose the meal. Confirm with the user first.',
      inputSchema: z.object({ mealId: z.number().int().positive() }),
      annotations: { destructiveHint: true },
    },
    async ({ mealId }) => {
      await meals.remove(userId, mealId);
      return { content: [{ type: 'text', text: `Deleted meal ${mealId}` }] };
    },
  );

  return server;
}
