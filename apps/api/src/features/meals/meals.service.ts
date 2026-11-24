import * as Sentry from '@sentry/node';
import type { Db } from '@app/db';
import {
  daysBetween,
  type CreateMeal,
  type ListMealsQuery,
  type Meal,
  type MealPhoto,
  type MealSummary,
  type PhotoContentType,
  type Suggestion,
  type UpdateMeal,
} from '@app/shared';
import { HttpError, notFound } from '../../lib/http-error.ts';
import type { HouseholdService } from '../household/household.service.ts';
import type { PhotoContent, PhotoStore, StoredPhoto } from './photo-store.ts';

type MealRow = {
  id: number;
  name: string;
  description: string | null;
  recipeUrl: string | null;
  tags: readonly string[];
  createdAt: Date;
};

type History = { lastEatenOn: string | null; timesEaten: number };

const photoPath = (photo: StoredPhoto) => `/meals/${photo.mealId}/photos/${photo.id}`;

/** The first bytes of each accepted image type, so an upload is what it claims to be. */
function looksLike(contentType: PhotoContentType, data: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((byte, i) => data[i] === byte);
  switch (contentType) {
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/webp':
      return starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...data.slice(8, 12)) === 'WEBP';
  }
}

/** Weighted random pick without replacement: meals not eaten for a while are likelier. */
function weightedSample<T>(items: { item: T; weight: number }[], count: number): T[] {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length > 0) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let target = Math.random() * total;
    const index = pool.findIndex((entry) => (target -= entry.weight) <= 0);
    const [chosen] = pool.splice(index === -1 ? pool.length - 1 : index, 1);
    if (chosen) picked.push(chosen.item);
  }
  return picked;
}

/** How long since a meal was eaten, as a suggestion weight. Never eaten counts as long ago. */
function suggestionWeight(history: History, today: string): number {
  const days = history.lastEatenOn ? daysBetween(history.lastEatenOn, today) : 90;
  // Two weeks of grace so recent meals can still come up, capped so old ones don't dominate.
  return Math.min(Math.max(days, 0), 90) + 14;
}

/**
 * The household's meal library: meals, their photos, their history, and suggestions.
 * Every method takes the acting user's ID and only touches their household's meals.
 */
export function createMealsService(db: Db, households: HouseholdService, photos: PhotoStore) {
  const Meals = db.orm.public.Meal;

  async function rows(householdId: number): Promise<MealRow[]> {
    return Meals.where({ householdId })
      .orderBy([(m) => m.name.asc(), (m) => m.id.asc()])
      .limit(1000)
      .all();
  }

  async function row(householdId: number, id: number): Promise<MealRow> {
    const meal = await Meals.where({ id, householdId }).first();
    if (!meal) throw notFound(`Meal ${id} not found`);
    return meal;
  }

  /** When each meal was last the dinner, and how often, counting nights up to today. */
  async function histories(householdId: number, today: string): Promise<Map<number, History>> {
    const dinners = await db.orm.public.Dinner.where({ householdId })
      .where((d) => d.date.lte(today))
      .where((d) => d.mealId.isNotNull())
      .select('mealId', 'date')
      .limit(20_000)
      .all();
    const result = new Map<number, History>();
    for (const { mealId, date } of dinners) {
      if (mealId === null) continue;
      const entry = result.get(mealId) ?? { lastEatenOn: null, timesEaten: 0 };
      entry.timesEaten += 1;
      if (!entry.lastEatenOn || date > entry.lastEatenOn) entry.lastEatenOn = date;
      result.set(mealId, entry);
    }
    return result;
  }

  async function photosByMeal(householdId: number, mealIds: readonly number[]) {
    const byMeal = new Map<number, MealPhoto[]>();
    for (const photo of await photos.list(householdId, mealIds)) {
      const list = byMeal.get(photo.mealId) ?? [];
      list.push({ id: photo.id, path: photoPath(photo), createdAt: photo.createdAt.toISOString() });
      byMeal.set(photo.mealId, list);
    }
    return byMeal;
  }

  function toSummary(meal: MealRow, mealPhotos: MealPhoto[] | undefined): MealSummary {
    return {
      id: meal.id,
      name: meal.name,
      tags: [...meal.tags],
      coverPhotoPath: mealPhotos?.[0]?.path ?? null,
    };
  }

  function toMeal(meal: MealRow, mealPhotos: MealPhoto[] = [], history?: History): Meal {
    return {
      ...toSummary(meal, mealPhotos),
      description: meal.description,
      recipeUrl: meal.recipeUrl,
      photos: mealPhotos,
      lastEatenOn: history?.lastEatenOn ?? null,
      timesEaten: history?.timesEaten ?? 0,
      createdAt: meal.createdAt.toISOString(),
    };
  }

  async function fullMeals(householdId: number, today: string, meals: MealRow[]) {
    const [byMeal, history] = await Promise.all([
      photosByMeal(
        householdId,
        meals.map((m) => m.id),
      ),
      histories(householdId, today),
    ]);
    return meals.map((m) => toMeal(m, byMeal.get(m.id), history.get(m.id)));
  }

  function matches(meal: MealRow, query: ListMealsQuery): boolean {
    if (query.tag && !meal.tags.includes(query.tag)) return false;
    if (!query.q) return true;
    const needle = query.q.toLowerCase();
    return [meal.name, meal.description ?? '', ...meal.tags].some((text) =>
      text.toLowerCase().includes(needle),
    );
  }

  return {
    async list(userId: string, query: ListMealsQuery = {}): Promise<Meal[]> {
      const household = await households.context(userId);
      const meals = (await rows(household.id)).filter((meal) => matches(meal, query));
      return fullMeals(household.id, household.today, meals);
    },

    async get(userId: string, id: number): Promise<Meal> {
      const household = await households.context(userId);
      const [meal] = await fullMeals(household.id, household.today, [await row(household.id, id)]);
      if (!meal) throw notFound(`Meal ${id} not found`);
      return meal;
    },

    /** A meal by name, ignoring case and surrounding spaces, or null. */
    async findByName(userId: string, name: string): Promise<Meal | null> {
      const household = await households.context(userId);
      const wanted = name.trim().toLowerCase();
      const meal = (await rows(household.id)).find((m) => m.name.toLowerCase() === wanted);
      if (!meal) return null;
      return (await fullMeals(household.id, household.today, [meal]))[0] ?? null;
    },

    async create(userId: string, input: CreateMeal): Promise<Meal> {
      const household = await households.context(userId);
      const meal = await Meals.create({
        householdId: household.id,
        createdByUserId: userId,
        name: input.name,
        description: input.description ?? null,
        recipeUrl: input.recipeUrl ?? null,
        tags: input.tags ?? [],
      });
      Sentry.metrics.count('meals.created', 1);
      return toMeal(meal);
    },

    async update(userId: string, id: number, input: UpdateMeal): Promise<Meal> {
      const household = await households.context(userId);
      await row(household.id, id);
      const changes = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
      );
      if (Object.keys(changes).length > 0) {
        await Meals.where({ id, householdId: household.id }).update(changes);
      }
      return this.get(userId, id);
    },

    async remove(userId: string, id: number): Promise<void> {
      const household = await households.context(userId);
      const deleted = await Meals.where({ id, householdId: household.id }).select('id').delete();
      if (!deleted) throw notFound(`Meal ${id} not found`);
    },

    /** Summaries of these meals (for plans), keyed by ID. Missing IDs are left out. */
    async summaries(
      householdId: number,
      ids: readonly number[],
    ): Promise<Map<number, MealSummary>> {
      const unique = [...new Set(ids)];
      if (unique.length === 0) return new Map();
      const meals = await Meals.where({ householdId })
        .where((m) => m.id.in(unique))
        .limit(unique.length)
        .all();
      const byMeal = await photosByMeal(householdId, unique);
      return new Map(meals.map((m) => [m.id, toSummary(m, byMeal.get(m.id))]));
    },

    async addPhoto(
      userId: string,
      mealId: number,
      contentType: PhotoContentType,
      data: Uint8Array,
    ): Promise<MealPhoto> {
      const household = await households.context(userId);
      await row(household.id, mealId);
      if (data.length === 0 || !looksLike(contentType, data)) {
        throw new HttpError(400, 'invalid_photo', `The upload is not a valid ${contentType} image`);
      }
      const photo = await photos.save({ householdId: household.id, mealId, contentType, data });
      Sentry.metrics.count('meals.photo_added', 1);
      return { id: photo.id, path: photoPath(photo), createdAt: photo.createdAt.toISOString() };
    },

    async photo(userId: string, mealId: number, photoId: number): Promise<PhotoContent> {
      const household = await households.context(userId);
      const content = await photos.read(household.id, mealId, photoId);
      if (!content) throw notFound(`Photo ${photoId} not found`);
      return content;
    },

    async removePhoto(userId: string, mealId: number, photoId: number): Promise<void> {
      const household = await households.context(userId);
      if (!(await photos.remove(household.id, mealId, photoId))) {
        throw notFound(`Photo ${photoId} not found`);
      }
    },

    /**
     * Meals to try: random, but favouring ones not eaten for a while, and never one in
     * `skip` (already planned or proposed, or rejected).
     */
    async suggest(
      userId: string,
      count: number,
      skip: ReadonlySet<number> = new Set(),
    ): Promise<Suggestion[]> {
      const household = await households.context(userId);
      const [meals, history] = await Promise.all([
        rows(household.id),
        histories(household.id, household.today),
      ]);
      const candidates = meals
        .filter((meal) => !skip.has(meal.id))
        .map((meal) => {
          const entry = history.get(meal.id) ?? { lastEatenOn: null, timesEaten: 0 };
          return { item: { meal, entry }, weight: suggestionWeight(entry, household.today) };
        });
      const picked = weightedSample(candidates, count);
      const byMeal = await photosByMeal(
        household.id,
        picked.map(({ meal }) => meal.id),
      );
      return picked.map(({ meal, entry }) => ({
        meal: toSummary(meal, byMeal.get(meal.id)),
        lastEatenOn: entry.lastEatenOn,
        timesEaten: entry.timesEaten,
      }));
    },
  };
}

export type MealsService = ReturnType<typeof createMealsService>;
