import { ApiErrorSchema, MealPhotoSchema, MealSchema, type Meal } from '@app/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import {
  mealImagePrompt,
  type MealDetails,
  type MealImageGenerator,
} from '../src/features/meals/image-generator.ts';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];

/**
 * A fake image generator that never calls a model: it records the details it was given (by
 * meal name) and returns a JPEG whose bytes carry the name. A name containing FAIL makes it
 * fail; one containing NOT_AN_IMAGE makes it return bytes that aren't an image.
 */
const requested = new Map<string, MealDetails>();
const fakeGenerator: MealImageGenerator = {
  async generate(meal) {
    requested.set(meal.name, meal);
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (meal.name.includes('FAIL')) throw new Error('simulated image model failure');
    if (meal.name.includes('NOT_AN_IMAGE')) {
      return { contentType: 'image/jpeg', data: new TextEncoder().encode('not an image') };
    }
    return {
      contentType: 'image/jpeg',
      data: new Uint8Array([...JPEG_HEADER, ...new TextEncoder().encode(meal.name)]),
    };
  },
};

const { app, db } = createTestApp({}, { imageGenerator: fakeGenerator });
const unconfigured = createTestApp();

afterAll(async () => {
  await db.close();
  await unconfigured.db.close();
});

async function createMeal(auth: string, body: object): Promise<Meal> {
  const res = await request(app).post('/meals').set('Authorization', auth).send(body).expect(201);
  return MealSchema.parse(res.body);
}

async function getMeal(auth: string, id: number): Promise<Meal> {
  const res = await request(app).get(`/meals/${id}`).set('Authorization', auth).expect(200);
  return MealSchema.parse(res.body);
}

const generate = (auth: string, mealId: number, target = app) =>
  request(target).post(`/meals/${mealId}/photos/generate`).set('Authorization', auth);

describe('generated meal photos', () => {
  it('makes a picture from the meal’s details and adds it as a generated meal photo', async () => {
    const auth = await bearer(uniqueUserId());
    const name = unique('Tikka masala');
    const meal = await createMeal(auth, {
      name,
      description: 'With rice and naan',
      tags: ['indian'],
      recipe: {
        ingredients: [{ item: 'chicken thighs' }, { item: 'cream', excluded: true }],
        steps: ['Cook.'],
      },
    });

    const res = await generate(auth, meal.id).expect(201);
    const photo = MealPhotoSchema.parse(res.body);
    expect(photo).toMatchObject({ kind: 'meal', generated: true, readStatus: null });

    expect(requested.get(name)).toMatchObject({
      name,
      description: 'With rice and naan',
      tags: ['indian'],
      recipe: { ingredients: [{ item: 'chicken thighs' }, { item: 'cream', excluded: true }] },
    });
    const served = await request(app).get(photo.path).set('Authorization', auth).expect(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    expect(
      Buffer.from(served.body as Buffer)
        .subarray(JPEG_HEADER.length)
        .toString(),
    ).toBe(name);
    expect((await getMeal(auth, meal.id)).coverPhotoPath).toBe(photo.path);
  });

  it('keeps a real photo as the cover, ahead of generated ones', async () => {
    const auth = await bearer(uniqueUserId());
    const meal = await createMeal(auth, { name: unique('Soup') });
    const generated = MealPhotoSchema.parse((await generate(auth, meal.id).expect(201)).body);
    const real = MealPhotoSchema.parse(
      (
        await request(app)
          .post(`/meals/${meal.id}/photos`)
          .set('Authorization', auth)
          .set('Content-Type', 'image/jpeg')
          .send(Buffer.from([...JPEG_HEADER, 1, 2, 3]))
          .expect(201)
      ).body,
    );
    expect(real.generated).toBe(false);

    const after = await getMeal(auth, meal.id);
    expect(after.coverPhotoPath).toBe(real.path);
    expect(after.photos.map((photo) => photo.id)).toEqual([real.id, generated.id]);
  });

  it('reports a failed generation and adds nothing', async () => {
    const auth = await bearer(uniqueUserId());
    for (const marker of ['FAIL', 'NOT_AN_IMAGE']) {
      const meal = await createMeal(auth, { name: unique(marker) });
      const res = await generate(auth, meal.id).expect(502);
      expect(ApiErrorSchema.parse(res.body).error.code).toBe('ai_failed');
      expect((await getMeal(auth, meal.id)).photos).toEqual([]);
    }
  });

  it('is a 503 when no image model is configured', async () => {
    const auth = await bearer(uniqueUserId());
    const res = await request(unconfigured.app)
      .post('/meals')
      .set('Authorization', auth)
      .send({ name: unique('Stew') })
      .expect(201);
    const meal = MealSchema.parse(res.body);
    const failed = await generate(auth, meal.id, unconfigured.app).expect(503);
    expect(ApiErrorSchema.parse(failed.body).error.code).toBe('ai_unavailable');
  });

  it('never makes a picture of another household’s meal', async () => {
    const owner = await bearer(uniqueUserId());
    const name = unique('Private');
    const meal = await createMeal(owner, { name });
    await generate(await bearer(uniqueUserId()), meal.id).expect(404);
    expect(requested.has(name)).toBe(false);
  });
});

describe('mealImagePrompt', () => {
  it('describes the dish with the ingredients the household uses', () => {
    const prompt = mealImagePrompt({
      name: 'Tikka masala',
      description: 'With rice and naan',
      tags: ['indian', 'curry'],
      recipe: {
        title: 'Chicken tikka masala',
        servings: null,
        prepTime: null,
        cookTime: null,
        ingredients: [
          { section: null, amount: '500 g', item: 'chicken thighs', note: null, excluded: false },
          { section: null, amount: '100 ml', item: 'double cream', note: null, excluded: true },
        ],
        steps: [],
        notes: null,
        adjustedSteps: null,
      },
    });
    expect(prompt).toContain('A photo of a home-cooked dinner: Tikka masala.');
    expect(prompt).toContain('Recipe: Chicken tikka masala.');
    expect(prompt).toContain('Details: With rice and naan');
    expect(prompt).toContain('Tags: indian, curry.');
    expect(prompt).toContain('Main ingredients: chicken thighs.');
    expect(prompt).not.toContain('double cream');
    expect(prompt).toContain('No text');
  });

  it('works from a name alone', () => {
    const prompt = mealImagePrompt({ name: 'Tacos', description: null, tags: [], recipe: null });
    expect(prompt).toContain('A photo of a home-cooked dinner: Tacos.');
    expect(prompt).not.toContain('Tags:');
  });
});
