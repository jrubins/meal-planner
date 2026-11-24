import * as Sentry from '@sentry/node';
import type { Db } from '@app/db';
import {
  weekDates,
  type AddOptions,
  type DinnerOption,
  type MealSummary,
  type Night,
  type SetDinner,
  type ShuffleWeekResult,
  type Suggestion,
  type SuggestMealsQuery,
  type Vote,
  type VoteValue,
  type Week,
} from '@app/shared';
import { HttpError, notFound } from '../../lib/http-error.ts';
import type { HouseholdContext, HouseholdService } from '../household/household.service.ts';
import type { MealsService } from '../meals/meals.service.ts';

const toVoteValue = (value: string): VoteValue => (value === 'down' ? 'down' : 'up');

/**
 * The weekly dinner plan: the chosen dinner for each night, options proposed for a night,
 * and members' votes on them. Every method takes the acting user's ID and only touches their
 * household's plan.
 */
export function createPlanService(db: Db, households: HouseholdService, meals: MealsService) {
  const { Dinner: Dinners, DinnerOption: Options, OptionVote: Votes } = db.orm.public;

  /** The nights from `first` to `last` (inclusive), as the API shows them. */
  async function nights(household: HouseholdContext, dates: readonly string[]): Promise<Night[]> {
    const first = dates[0];
    const last = dates.at(-1);
    if (!first || !last) return [];

    const [dinners, options] = await Promise.all([
      Dinners.where({ householdId: household.id })
        .where((d) => d.date.gte(first))
        .where((d) => d.date.lte(last))
        .limit(dates.length)
        .all(),
      Options.where({ householdId: household.id })
        .where((o) => o.date.gte(first))
        .where((o) => o.date.lte(last))
        .include('votes', (votes) =>
          votes.orderBy([(v) => v.createdAt.asc(), (v) => v.id.asc()]),
        )
        .orderBy([(o) => o.createdAt.asc(), (o) => o.id.asc()])
        .limit(500)
        .all(),
    ]);
    const summaries = await meals.summaries(household.id, [
      ...dinners.flatMap((d) => (d.mealId === null ? [] : [d.mealId])),
      ...options.map((o) => o.mealId),
    ]);
    const meal = (id: number | null): MealSummary | null =>
      id === null ? null : (summaries.get(id) ?? null);

    return dates.map((date) => {
      const dinner = dinners.find((d) => d.date === date);
      const nightOptions = options.filter((o) => o.date === date);
      return {
        date,
        dinner: dinner ? { date, meal: meal(dinner.mealId), note: dinner.note } : null,
        options: nightOptions.flatMap((o): DinnerOption[] => {
          const optionMeal = meal(o.mealId);
          if (!optionMeal) return [];
          return [
            {
              id: o.id,
              date,
              meal: optionMeal,
              proposedByUserId: o.proposedByUserId,
              votes: o.votes.map((v) => ({ userId: v.userId, value: toVoteValue(v.value) })),
              chosen: dinner?.mealId === o.mealId,
            },
          ];
        }),
      };
    });
  }

  async function night(household: HouseholdContext, date: string): Promise<Night> {
    const [result] = await nights(household, [date]);
    if (!result) throw notFound(`Night ${date} not found`);
    return result;
  }

  async function week(household: HouseholdContext, userId: string, date?: string): Promise<Week> {
    const dates = weekDates(date ?? household.today, household.weekStartsOn);
    const [weekNights, { members }] = await Promise.all([
      nights(household, dates),
      households.get(userId),
    ]);
    return {
      start: dates[0] ?? household.today,
      end: dates.at(-1) ?? household.today,
      today: household.today,
      nights: weekNights,
      members,
    };
  }

  /** Meal IDs already planned or proposed in a week, so suggestions skip them. */
  function mealsIn(planned: Week): Set<number> {
    return new Set(
      planned.nights.flatMap((n) => [
        ...(n.dinner?.meal ? [n.dinner.meal.id] : []),
        ...n.options.map((o) => o.meal.id),
      ]),
    );
  }

  async function requireMeals(userId: string, mealIds: readonly number[]): Promise<void> {
    const household = await households.context(userId);
    const found = await meals.summaries(household.id, mealIds);
    const missing = mealIds.filter((id) => !found.has(id));
    if (missing.length > 0) throw notFound(`Meal ${missing.join(', ')} not found`);
  }

  async function option(householdId: number, id: number) {
    const row = await Options.where({ id, householdId }).first();
    if (!row) throw notFound(`Option ${id} not found`);
    return row;
  }

  async function setDinner(userId: string, date: string, input: SetDinner): Promise<Night> {
    const household = await households.context(userId);
    if (input.mealId != null) await requireMeals(userId, [input.mealId]);
    const values = {
      mealId: input.mealId ?? null,
      note: input.note ?? null,
      updatedByUserId: userId,
    };
    const existing = await Dinners.where({ householdId: household.id, date }).first();
    if (existing) {
      await Dinners.where({ id: existing.id }).update(values);
    } else {
      await Dinners.create({ householdId: household.id, date, ...values });
    }
    Sentry.metrics.count('plan.dinner_set', 1);
    return night(household, date);
  }

  return {
    async week(userId: string, date?: string): Promise<Week> {
      return week(await households.context(userId), userId, date);
    },

    async night(userId: string, date: string): Promise<Night> {
      return night(await households.context(userId), date);
    },

    setDinner,

    async clearDinner(userId: string, date: string): Promise<Night> {
      const household = await households.context(userId);
      await Dinners.where({ householdId: household.id, date }).deleteAll();
      return night(household, date);
    },

    /** Proposes meals for a night. Meals already proposed for it are left as they are. */
    async addOptions(userId: string, input: AddOptions): Promise<Night> {
      const household = await households.context(userId);
      await requireMeals(userId, input.mealIds);
      const existing = await Options.where({ householdId: household.id, date: input.date })
        .select('mealId')
        .limit(500)
        .all();
      const proposed = new Set(existing.map((o) => o.mealId));
      for (const mealId of new Set(input.mealIds)) {
        if (proposed.has(mealId)) continue;
        await Options.create({
          householdId: household.id,
          date: input.date,
          mealId,
          proposedByUserId: userId,
        });
      }
      return night(household, input.date);
    },

    async removeOption(userId: string, id: number): Promise<Night> {
      const household = await households.context(userId);
      const row = await option(household.id, id);
      await Options.where({ id: row.id }).delete();
      return night(household, row.date);
    },

    async vote(userId: string, optionId: number, { vote }: Vote): Promise<Night> {
      const household = await households.context(userId);
      const row = await option(household.id, optionId);
      const existing = await Votes.where({ optionId, userId }).first();
      if (vote === 'none') {
        if (existing) await Votes.where({ id: existing.id }).delete();
      } else if (existing) {
        await Votes.where({ id: existing.id }).update({ value: vote });
      } else {
        await Votes.create({ optionId, userId, value: vote });
      }
      return night(household, row.date);
    },

    /** Makes an option's meal the night's dinner (keeping any note). Options stay listed. */
    async chooseOption(userId: string, optionId: number): Promise<Night> {
      const household = await households.context(userId);
      const row = await option(household.id, optionId);
      const current = await Dinners.where({ householdId: household.id, date: row.date }).first();
      return setDinner(userId, row.date, { mealId: row.mealId, note: current?.note ?? null });
    },

    async suggest(userId: string, query: SuggestMealsQuery): Promise<Suggestion[]> {
      const household = await households.context(userId);
      const planned = await week(household, userId, query.date);
      const skip = mealsIn(planned);
      for (const id of query.exclude ?? []) skip.add(id);
      return meals.suggest(userId, query.count, skip);
    },

    /**
     * Inspiration for a whole week: adds suggested options to every night that has neither a
     * dinner nor options, never repeating a meal already in the week.
     */
    async shuffleWeek(
      userId: string,
      date: string | undefined,
      optionsPerNight: number,
    ): Promise<ShuffleWeekResult> {
      const household = await households.context(userId);
      const before = await week(household, userId, date);
      const empty = before.nights.filter((n) => !n.dinner && n.options.length === 0);
      if (empty.length === 0) return { week: before, added: [] };

      const picks = await meals.suggest(userId, empty.length * optionsPerNight, mealsIn(before));
      if (picks.length === 0) {
        throw new HttpError(409, 'no_meals', 'Add some meals first, then shuffle');
      }
      for (const [i, n] of empty.entries()) {
        for (const pick of picks.slice(i * optionsPerNight, (i + 1) * optionsPerNight)) {
          await Options.create({
            householdId: household.id,
            date: n.date,
            mealId: pick.meal.id,
            proposedByUserId: userId,
          });
        }
      }
      const after = await week(household, userId, date);
      const emptyDates = new Set(empty.map((n) => n.date));
      return {
        week: after,
        added: after.nights.filter((n) => emptyDates.has(n.date)).flatMap((n) => n.options),
      };
    },
  };
}

export type PlanService = ReturnType<typeof createPlanService>;
