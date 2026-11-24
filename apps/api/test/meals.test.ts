import {
  ApiErrorSchema,
  MealPhotoSchema,
  MealSchema,
  SuggestionSchema,
  type Meal,
} from '@app/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

const { app, db } = createTestApp();

afterAll(async () => {
  await db.close();
});

/** The first bytes of a JPEG: enough for the API's type check. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00]);

async function asNewUser() {
  return { auth: await bearer(uniqueUserId()) };
}

async function createMeal(auth: string, body: object): Promise<Meal> {
  const res = await request(app).post('/meals').set('Authorization', auth).send(body).expect(201);
  return MealSchema.parse(res.body);
}

async function listMeals(auth: string, query = ''): Promise<Meal[]> {
  const res = await request(app).get(`/meals${query}`).set('Authorization', auth).expect(200);
  return MealSchema.array().parse(res.body);
}

describe('meals API', () => {
  it('creates a meal, tidying its fields', async () => {
    const { auth } = await asNewUser();
    const name = unique('Lasagne');
    const meal = await createMeal(auth, {
      name: `  ${name} `,
      description: ' ',
      recipeUrl: 'https://example.com/lasagne',
      tags: ['Pasta', 'pasta', ' Weekend '],
    });
    expect(meal).toMatchObject({
      name,
      description: null,
      recipeUrl: 'https://example.com/lasagne',
      tags: ['pasta', 'weekend'],
      photos: [],
      coverPhotoPath: null,
      lastEatenOn: null,
      timesEaten: 0,
    });
    expect(await listMeals(auth)).toContainEqual(meal);
  });

  it('searches by name, description and tag', async () => {
    const { auth } = await asNewUser();
    const word = unique('zesty').replaceAll(' ', '');
    const byName = await createMeal(auth, { name: `${word} noodles` });
    const byNotes = await createMeal(auth, { name: unique('Soup'), description: `very ${word}` });
    const other = await createMeal(auth, { name: unique('Plain'), tags: ['quick'] });

    const found = (await listMeals(auth, `?q=${word.toUpperCase()}`)).map((m) => m.id);
    expect(found).toEqual(expect.arrayContaining([byName.id, byNotes.id]));
    expect(found).not.toContain(other.id);
    expect((await listMeals(auth, '?tag=quick')).map((m) => m.id)).toEqual([other.id]);
  });

  it('updates and deletes a meal', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Chili') });
    const res = await request(app)
      .patch(`/meals/${meal.id}`)
      .set('Authorization', auth)
      .send({ description: 'Extra beans', tags: ['spicy'] })
      .expect(200);
    expect(MealSchema.parse(res.body)).toMatchObject({
      name: meal.name,
      description: 'Extra beans',
      tags: ['spicy'],
    });

    await request(app).delete(`/meals/${meal.id}`).set('Authorization', auth).expect(204);
    await request(app).get(`/meals/${meal.id}`).set('Authorization', auth).expect(404);
  });

  it('rejects a recipe link that is not a web address', async () => {
    const { auth } = await asNewUser();
    const res = await request(app)
      .post('/meals')
      .set('Authorization', auth)
      .send({ name: unique('Bad link'), recipeUrl: 'javascript:alert(1)' })
      .expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('validation_error');
  });

  it("keeps each household's meals private", async () => {
    const owner = await asNewUser();
    const other = await asNewUser();
    const meal = await createMeal(owner.auth, { name: unique('Private') });
    expect((await listMeals(other.auth)).map((m) => m.id)).not.toContain(meal.id);
    await request(app).get(`/meals/${meal.id}`).set('Authorization', other.auth).expect(404);
    await request(app).delete(`/meals/${meal.id}`).set('Authorization', other.auth).expect(404);
  });

  it('records when a meal was last eaten', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Roast') });
    for (const date of ['2025-01-05', '2025-02-09']) {
      await request(app)
        .put(`/plan/nights/${date}/dinner`)
        .set('Authorization', auth)
        .send({ mealId: meal.id })
        .expect(200);
    }
    const res = await request(app).get(`/meals/${meal.id}`).set('Authorization', auth).expect(200);
    expect(MealSchema.parse(res.body)).toMatchObject({ lastEatenOn: '2025-02-09', timesEaten: 2 });
  });
});

describe('meal photos', () => {
  it('uploads, serves and deletes a photo', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Pizza') });

    const uploaded = await request(app)
      .post(`/meals/${meal.id}/photos`)
      .set('Authorization', auth)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(201);
    const photo = MealPhotoSchema.parse(uploaded.body);
    expect(photo.path).toBe(`/meals/${meal.id}/photos/${photo.id}`);

    const served = await request(app).get(photo.path).set('Authorization', auth).expect(200);
    expect(served.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.from(served.body as Buffer)).toEqual(JPEG);

    const withPhoto = await request(app).get(`/meals/${meal.id}`).set('Authorization', auth);
    expect(MealSchema.parse(withPhoto.body)).toMatchObject({
      coverPhotoPath: photo.path,
      photos: [photo],
    });

    await request(app).delete(photo.path).set('Authorization', auth).expect(204);
    await request(app).get(photo.path).set('Authorization', auth).expect(404);
  });

  it('refuses uploads that are not images', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Fake') });
    await request(app)
      .post(`/meals/${meal.id}/photos`)
      .set('Authorization', auth)
      .set('Content-Type', 'text/html')
      .send('<script>')
      .expect(415);
    const res = await request(app)
      .post(`/meals/${meal.id}/photos`)
      .set('Authorization', auth)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not a png'))
      .expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('invalid_photo');
  });

  it("hides other households' photos", async () => {
    const owner = await asNewUser();
    const other = await asNewUser();
    const meal = await createMeal(owner.auth, { name: unique('Secret') });
    const uploaded = await request(app)
      .post(`/meals/${meal.id}/photos`)
      .set('Authorization', owner.auth)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(201);
    const photo = MealPhotoSchema.parse(uploaded.body);
    await request(app).get(photo.path).set('Authorization', other.auth).expect(404);
    await request(app)
      .post(`/meals/${meal.id}/photos`)
      .set('Authorization', other.auth)
      .set('Content-Type', 'image/jpeg')
      .send(JPEG)
      .expect(404);
  });
});

describe('suggestions', () => {
  it('suggests meals, skipping excluded ones', async () => {
    const { auth } = await asNewUser();
    const keep = await createMeal(auth, { name: unique('Keep') });
    const skip = await createMeal(auth, { name: unique('Skip') });

    const res = await request(app)
      .get(`/meals/suggestions?count=5&exclude=${skip.id}`)
      .set('Authorization', auth)
      .expect(200);
    const ids = SuggestionSchema.array()
      .parse(res.body)
      .map((s) => s.meal.id);
    expect(ids).toEqual([keep.id]);
  });

  it("skips meals already in the week's plan", async () => {
    const { auth } = await asNewUser();
    const planned = await createMeal(auth, { name: unique('Planned') });
    const free = await createMeal(auth, { name: unique('Free') });
    await request(app)
      .put('/plan/nights/2026-03-03/dinner')
      .set('Authorization', auth)
      .send({ mealId: planned.id })
      .expect(200);

    const res = await request(app)
      .get('/meals/suggestions?count=5&date=2026-03-05')
      .set('Authorization', auth)
      .expect(200);
    expect(
      SuggestionSchema.array()
        .parse(res.body)
        .map((s) => s.meal.id),
    ).toEqual([free.id]);
  });
});
