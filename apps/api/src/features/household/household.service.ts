import { randomInt } from 'node:crypto';
import type { Db } from '@app/db';
import {
  isValidTimeZone,
  todayIn,
  type Household,
  type JoinHousehold,
  type UpdateHousehold,
  type UpdateMember,
  type WeekStartsOn,
} from '@app/shared';
import { HttpError, notFound } from '../../lib/http-error.ts';

/** No 0/O or 1/I, so codes read aloud or typed from a phone don't get mixed up. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newInviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

type HouseholdRow = {
  id: number;
  name: string;
  inviteCode: string;
  timeZone: string;
  weekStartsOn: number;
};

/** What other services need to know about the acting user's household. */
export interface HouseholdContext {
  id: number;
  timeZone: string;
  weekStartsOn: WeekStartsOn;
  today: string;
}

const toWeekStartsOn = (value: number): WeekStartsOn => (value === 0 ? 0 : 1);

/**
 * Households: the people who plan dinners together. Every user belongs to exactly one,
 * created on their first request; a partner joins it with its invite code. Every other
 * service resolves the acting user's household here and filters its queries by its ID.
 */
export function createHouseholdService(db: Db) {
  const { Household: Households, HouseholdMember: Members } = db.orm.public;

  async function membership(userId: string) {
    const existing = await Members.where({ userId }).first();
    if (existing) return existing;

    const household = await Households.create({
      name: 'Our household',
      inviteCode: newInviteCode(),
    });
    try {
      return await Members.create({ userId, householdId: household.id });
    } catch (error) {
      // Two first requests raced: the other one made this user's membership. Use it.
      await Households.where({ id: household.id }).delete();
      const raced = await Members.where({ userId }).first();
      if (raced) return raced;
      throw error;
    }
  }

  async function householdRow(userId: string): Promise<HouseholdRow> {
    const { householdId } = await membership(userId);
    const row = await Households.where({ id: householdId }).first();
    if (!row) throw notFound('Household not found');
    return row;
  }

  async function toHousehold(userId: string, row: HouseholdRow): Promise<Household> {
    const members = await Members.where({ householdId: row.id })
      .orderBy([(m) => m.createdAt.asc(), (m) => m.id.asc()])
      .limit(20)
      .all();
    return {
      id: row.id,
      name: row.name,
      inviteCode: row.inviteCode,
      timeZone: row.timeZone,
      weekStartsOn: toWeekStartsOn(row.weekStartsOn),
      today: todayIn(row.timeZone),
      members: members.map((m) => ({ userId: m.userId, displayName: m.displayName })),
      me: userId,
    };
  }

  return {
    /** The acting user's household (created on first use), for other services. */
    async context(userId: string): Promise<HouseholdContext> {
      const row = await householdRow(userId);
      return {
        id: row.id,
        timeZone: row.timeZone,
        weekStartsOn: toWeekStartsOn(row.weekStartsOn),
        today: todayIn(row.timeZone),
      };
    },

    async get(userId: string): Promise<Household> {
      return toHousehold(userId, await householdRow(userId));
    },

    async update(userId: string, input: UpdateHousehold): Promise<Household> {
      if (input.timeZone !== undefined && !isValidTimeZone(input.timeZone)) {
        throw new HttpError(400, 'validation_error', `Unknown time zone "${input.timeZone}"`);
      }
      const { id } = await householdRow(userId);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      const row =
        Object.keys(changes).length > 0
          ? await Households.where({ id }).update(changes)
          : await Households.where({ id }).first();
      if (!row) throw notFound('Household not found');
      return toHousehold(userId, row);
    },

    async updateMe(userId: string, input: UpdateMember): Promise<Household> {
      await membership(userId);
      await Members.where({ userId }).update({ displayName: input.displayName });
      return this.get(userId);
    },

    async regenerateInviteCode(userId: string): Promise<Household> {
      const { id } = await householdRow(userId);
      const row = await Households.where({ id }).update({ inviteCode: newInviteCode() });
      if (!row) throw notFound('Household not found');
      return toHousehold(userId, row);
    },

    /**
     * Moves the acting user into the household with this invite code. When they were the only
     * member of their old household, its meals (and their photos) come with them; its plan is
     * dropped, and so is the old household.
     */
    async join(userId: string, input: JoinHousehold): Promise<Household> {
      const target = await Households.where({ inviteCode: input.inviteCode }).first();
      if (!target) throw notFound('No household has that invite code');
      const current = await membership(userId);
      if (current.householdId === target.id) return toHousehold(userId, target);

      const oldId = current.householdId;
      await Members.where({ userId }).update({ householdId: target.id });

      const remaining = await Members.where({ householdId: oldId }).limit(1).all();
      if (remaining.length === 0) {
        const { Meal, MealPhoto, Dinner, DinnerOption } = db.orm.public;
        await Meal.where({ householdId: oldId }).updateAll({ householdId: target.id });
        await MealPhoto.where({ householdId: oldId }).updateAll({ householdId: target.id });
        // The old plan points at nights the new household plans for itself.
        await Dinner.where({ householdId: oldId }).deleteAll();
        await DinnerOption.where({ householdId: oldId }).deleteAll();
        await Households.where({ id: oldId }).delete();
      }
      return toHousehold(userId, target);
    },
  };
}

export type HouseholdService = ReturnType<typeof createHouseholdService>;
