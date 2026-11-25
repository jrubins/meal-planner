import { randomUUID } from 'node:crypto';
import { MealPhotoSchema, MealSchema, type Meal, type MealPhoto } from '@app/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { RecipeReader } from '../src/features/meals/recipe-reader.ts';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

/**
 * A fake recipe reader that never calls Claude. Each test image is a JPEG header followed by
 * an instruction: "RECIPE <text>", "NOT_A_RECIPE", or "FAIL_ONCE <id> <text>" (fails the first
 * read of that photo, then reads <text>). It waits a little, like a real reading.
 */
const failedOnce = new Set<string>();
const fakeReader: RecipeReader = {
  async read({ data }) {
    await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 40));
    const instruction = Buffer.from(data.slice(JPEG_HEADER.length)).toString('utf8');
    if (instruction === 'NOT_A_RECIPE') return { isRecipe: false };
    const failOnce = /^FAIL_ONCE (\S+) (.*)$/s.exec(instruction);
    if (failOnce?.[1] && failOnce[2]) {
      if (!failedOnce.has(failOnce[1])) {
        failedOnce.add(failOnce[1]);
        throw new Error('simulated API failure');
      }
      return { isRecipe: true, text: failOnce[2] };
    }
    return { isRecipe: true, text: instruction.replace(/^RECIPE /, '') };
  },
};

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const image = (instruction: string) =>
  Buffer.concat([Buffer.from(JPEG_HEADER), Buffer.from(instruction, 'utf8')]);

const { app, db } = createTestApp({}, { recipeReader: fakeReader });
const unread = createTestApp();

afterAll(async () => {
  await db.close();
  await unread.db.close();
});

async function asNewUser() {
  return { auth: await bearer(uniqueUserId()) };
}

async function createMeal(auth: string, body: object = { name: unique('Meal') }): Promise<Meal> {
  const res = await request(app).post('/meals').set('Authorization', auth).send(body).expect(201);
  return MealSchema.parse(res.body);
}

async function upload(
  auth: string,
  mealId: number,
  kind: 'meal' | 'recipe',
  body: Buffer,
  target = app,
): Promise<MealPhoto> {
  const res = await request(target)
    .post(`/meals/${mealId}/photos?kind=${kind}`)
    .set('Authorization', auth)
    .set('Content-Type', 'image/jpeg')
    .send(body)
    .expect(201);
  return MealPhotoSchema.parse(res.body);
}

async function getMeal(auth: string, id: number): Promise<Meal> {
  const res = await request(app).get(`/meals/${id}`).set('Authorization', auth).expect(200);
  return MealSchema.parse(res.body);
}

/** The meal once no recipe photo is still being read. */
async function afterReading(auth: string, id: number): Promise<Meal> {
  for (let i = 0; i < 100; i++) {
    const meal = await getMeal(auth, id);
    if (!meal.photos.some((photo) => photo.readStatus === 'reading')) return meal;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('recipe photos were still being read after 2 seconds');
}

describe('recipe photos', () => {
  it('keeps meal photos and recipe photos apart; only meal photos are the cover', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);

    const recipePhoto = await upload(auth, meal.id, 'recipe', image('RECIPE Stir.'));
    expect(recipePhoto).toMatchObject({ kind: 'recipe', readStatus: 'reading' });
    expect((await afterReading(auth, meal.id)).coverPhotoPath).toBeNull();

    const dishPhoto = await upload(auth, meal.id, 'meal', image('dish'));
    expect(dishPhoto).toMatchObject({ kind: 'meal', readStatus: null });
    const after = await getMeal(auth, meal.id);
    expect(after.coverPhotoPath).toBe(dishPhoto.path);
    expect(after.photos.map((photo) => photo.kind)).toEqual(['recipe', 'meal']);
  });

  it('reads a recipe photo into the meal’s recipe text', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const text = `Pancakes ${randomUUID()}\nIngredients:\n- 2 eggs\nSteps:\n1. Whisk.`;

    await upload(auth, meal.id, 'recipe', image(`RECIPE ${text}`));

    const read = await afterReading(auth, meal.id);
    expect(read.recipeText).toBe(text);
    expect(read.photos[0]?.readStatus).toBe('done');
  });

  it('adds each recipe photo’s text after what’s already there, even when read at once', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Lasagne'), recipeText: 'Typed notes' });
    const pages = ['Page one', 'Page two', 'Page three'].map((page) => unique(page));

    // Uploaded back to back, so the readings overlap and finish in any order.
    for (const page of pages) await upload(auth, meal.id, 'recipe', image(`RECIPE ${page}`));

    const { recipeText } = await afterReading(auth, meal.id);
    expect(recipeText?.startsWith('Typed notes\n\n')).toBe(true);
    for (const page of pages) expect(recipeText).toContain(page);
  });

  it('leaves the recipe alone when the photo isn’t a recipe', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);

    await upload(auth, meal.id, 'recipe', image('NOT_A_RECIPE'));

    const read = await afterReading(auth, meal.id);
    expect(read.recipeText).toBeNull();
    expect(read.photos[0]?.readStatus).toBe('not_a_recipe');
  });

  it('marks a failed reading, and reads it again on request', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const text = unique('Soup');

    const photo = await upload(auth, meal.id, 'recipe', image(`FAIL_ONCE ${randomUUID()} ${text}`));
    expect((await afterReading(auth, meal.id)).photos[0]?.readStatus).toBe('failed');

    const reread = await request(app)
      .post(`${photo.path}/read`)
      .set('Authorization', auth)
      .expect(200);
    expect(MealPhotoSchema.parse(reread.body).readStatus).toBe('reading');
    const read = await afterReading(auth, meal.id);
    expect(read.recipeText).toBe(text);
    expect(read.photos[0]?.readStatus).toBe('done');
  });

  it('only reads recipe photos', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const photo = await upload(auth, meal.id, 'meal', image('dish'));
    await request(app).post(`${photo.path}/read`).set('Authorization', auth).expect(400);
  });

  it('keeps recipe photos unread when recipe reading isn’t set up', async () => {
    const auth = await bearer(uniqueUserId());
    const res = await request(unread.app)
      .post('/meals')
      .set('Authorization', auth)
      .send({ name: unique('Unread') })
      .expect(201);
    const meal = MealSchema.parse(res.body);

    const photo = await upload(auth, meal.id, 'recipe', image('RECIPE Never read'), unread.app);

    expect(photo.readStatus).toBe('unavailable');
  });

  it('accepts recipe text typed in, and finds meals by it', async () => {
    const { auth } = await asNewUser();
    const word = unique('saffron').replaceAll(' ', '');
    const meal = await createMeal(auth, { name: unique('Paella'), recipeText: `Add ${word}.` });
    expect(meal.recipeText).toBe(`Add ${word}.`);

    const found = await request(app).get(`/meals?q=${word}`).set('Authorization', auth).expect(200);
    expect(
      MealSchema.array()
        .parse(found.body)
        .map((m) => m.id),
    ).toEqual([meal.id]);

    const cleared = await request(app)
      .patch(`/meals/${meal.id}`)
      .set('Authorization', auth)
      .send({ recipeText: '' })
      .expect(200);
    expect(MealSchema.parse(cleared.body).recipeText).toBeNull();
  });

  it('rejects an unknown photo kind', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    await request(app)
      .post(`/meals/${meal.id}/photos?kind=menu`)
      .set('Authorization', auth)
      .set('Content-Type', 'image/jpeg')
      .send(image('x'))
      .expect(400);
  });
});
