import { randomUUID } from 'node:crypto';
import {
  ApiErrorSchema,
  currentAdjustedSteps,
  MealPhotoSchema,
  MealSchema,
  RecipeInputSchema,
  type Meal,
  type MealPhoto,
  type RecipeInput,
} from '@app/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import type { RecipeReader } from '../src/features/meals/recipe-reader.ts';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

/**
 * A fake recipe reader that never calls a model. Each test image is a JPEG header followed by
 * an instruction: "RECIPE <json>", "NOT_A_RECIPE", or "FAIL_ONCE <id> <json>" (fails the first
 * read of that photo, then reads <json>). It waits a little, like a real reading.
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
      return { isRecipe: true, recipe: RecipeInputSchema.parse(JSON.parse(failOnce[2])) };
    }
    const json = instruction.replace(/^RECIPE /, '');
    return { isRecipe: true, recipe: RecipeInputSchema.parse(JSON.parse(json)) };
  },
  // Drops steps that mention a left-out ingredient; a step saying FAIL makes it fail.
  async adjustSteps(recipe) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    if (recipe.steps.some((step) => step.includes('FAIL'))) throw new Error('simulated failure');
    const leftOut = recipe.ingredients.filter((i) => i.excluded).map((i) => i.item);
    return recipe.steps.filter((step) => !leftOut.some((item) => step.includes(item)));
  },
};

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const image = (instruction: string) =>
  Buffer.concat([Buffer.from(JPEG_HEADER), Buffer.from(instruction, 'utf8')]);
const recipeImage = (recipe: RecipeInput) => image(`RECIPE ${JSON.stringify(recipe)}`);

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

    const recipePhoto = await upload(auth, meal.id, 'recipe', recipeImage({ steps: ['Stir.'] }));
    expect(recipePhoto).toMatchObject({ kind: 'recipe', readStatus: 'reading' });
    expect((await afterReading(auth, meal.id)).coverPhotoPath).toBeNull();

    const dishPhoto = await upload(auth, meal.id, 'meal', image('dish'));
    expect(dishPhoto).toMatchObject({ kind: 'meal', readStatus: null });
    const after = await getMeal(auth, meal.id);
    expect(after.coverPhotoPath).toBe(dishPhoto.path);
    expect(after.photos.map((photo) => photo.kind)).toEqual(['recipe', 'meal']);
  });

  it('reads a recipe photo into the meal’s structured recipe', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const title = unique('Pancakes');

    await upload(
      auth,
      meal.id,
      'recipe',
      recipeImage({
        title,
        servings: '4',
        ingredients: [
          { amount: '2', item: 'eggs' },
          { item: 'salt', note: 'a pinch' },
        ],
        steps: ['Whisk.', 'Fry.'],
      }),
    );

    const read = await afterReading(auth, meal.id);
    expect(read.recipe).toEqual({
      title,
      servings: '4',
      prepTime: null,
      cookTime: null,
      ingredients: [
        { section: null, amount: '2', item: 'eggs', note: null, excluded: false },
        { section: null, amount: null, item: 'salt', note: 'a pinch', excluded: false },
      ],
      steps: ['Whisk.', 'Fry.'],
      notes: null,
      adjustedSteps: null,
    });
    expect(read.photos[0]?.readStatus).toBe('done');
  });

  it('adds each page after what’s already there, even when read at once', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, {
      name: unique('Lasagne'),
      recipe: { title: 'Lasagne', steps: ['Typed step.'] },
    });
    const pages = ['Page one', 'Page two', 'Page three'].map((page) => unique(page));

    // Uploaded back to back, so the readings overlap and finish in any order.
    for (const page of pages) {
      await upload(
        auth,
        meal.id,
        'recipe',
        recipeImage({ title: page, ingredients: [{ item: `${page} item` }], steps: [page] }),
      );
    }

    const { recipe } = await afterReading(auth, meal.id);
    // The typed title and step stay first; every page's ingredient and step is kept.
    expect(recipe?.title).toBe('Lasagne');
    expect(recipe?.steps[0]).toBe('Typed step.');
    expect([...(recipe?.steps ?? [])].sort()).toEqual(['Typed step.', ...pages].sort());
    expect(recipe?.ingredients.map((i) => i.item).sort()).toEqual(
      pages.map((page) => `${page} item`).sort(),
    );
  });

  it('leaves the recipe alone when the photo isn’t a recipe', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);

    await upload(auth, meal.id, 'recipe', image('NOT_A_RECIPE'));

    const read = await afterReading(auth, meal.id);
    expect(read.recipe).toBeNull();
    expect(read.photos[0]?.readStatus).toBe('not_a_recipe');
  });

  it('marks a failed reading, and reads it again on request', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const step = unique('Simmer');

    const photo = await upload(
      auth,
      meal.id,
      'recipe',
      image(`FAIL_ONCE ${randomUUID()} ${JSON.stringify({ steps: [step] })}`),
    );
    expect((await afterReading(auth, meal.id)).photos[0]?.readStatus).toBe('failed');

    const reread = await request(app)
      .post(`${photo.path}/read`)
      .set('Authorization', auth)
      .expect(200);
    expect(MealPhotoSchema.parse(reread.body).readStatus).toBe('reading');
    const read = await afterReading(auth, meal.id);
    expect(read.recipe?.steps).toEqual([step]);
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

    const photo = await upload(auth, meal.id, 'recipe', recipeImage({ steps: ['x'] }), unread.app);

    expect(photo.readStatus).toBe('unavailable');
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

describe('structured recipes', () => {
  it('accepts a recipe typed in, filling in what’s left out, and finds meals by it', async () => {
    const { auth } = await asNewUser();
    const spice = unique('saffron').replaceAll(' ', '');
    const meal = await createMeal(auth, {
      name: unique('Paella'),
      recipe: {
        ingredients: [{ section: ' For the rice ', amount: ' 1 pinch ', item: spice }],
        steps: ['Toast the rice.'],
      },
    });
    expect(meal.recipe).toEqual({
      title: null,
      servings: null,
      prepTime: null,
      cookTime: null,
      ingredients: [
        { section: 'For the rice', amount: '1 pinch', item: spice, note: null, excluded: false },
      ],
      steps: ['Toast the rice.'],
      notes: null,
      adjustedSteps: null,
    });

    const found = await request(app)
      .get(`/meals?q=${spice}`)
      .set('Authorization', auth)
      .expect(200);
    expect(
      MealSchema.array()
        .parse(found.body)
        .map((m) => m.id),
    ).toEqual([meal.id]);
  });

  it('replaces the whole recipe on update, and removes it with null or an empty one', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Soup'), recipe: { steps: ['Old.'] } });
    const update = (recipe: unknown) =>
      request(app)
        .patch(`/meals/${meal.id}`)
        .set('Authorization', auth)
        .send({ recipe })
        .expect(200)
        .then((res) => MealSchema.parse(res.body).recipe);

    expect((await update({ steps: ['New.'] }))?.steps).toEqual(['New.']);
    expect(await update({ steps: [], ingredients: [] })).toBeNull();
    await update({ steps: ['Again.'] });
    expect(await update(null)).toBeNull();
  });

  it('rejects an ingredient without an item', async () => {
    const { auth } = await asNewUser();
    await request(app)
      .post('/meals')
      .set('Authorization', auth)
      .send({ name: unique('Bad'), recipe: { ingredients: [{ amount: '2', item: ' ' }] } })
      .expect(400);
  });

  it('shows a recipe saved as plain text (before structured recipes) as its notes', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const legacy = unique('Old recipe text');
    await db.orm.public.Meal.where({ id: meal.id }).update({ recipeText: legacy });

    expect((await getMeal(auth, meal.id)).recipe).toMatchObject({ notes: legacy, steps: [] });

    // The next save moves it into the structured recipe for good.
    await request(app)
      .patch(`/meals/${meal.id}`)
      .set('Authorization', auth)
      .send({ recipe: { notes: legacy, steps: ['Cook.'] } })
      .expect(200);
    const row = await db.orm.public.Meal.where({ id: meal.id }).select('recipeText').first();
    expect(row?.recipeText).toBeNull();
    expect((await getMeal(auth, meal.id)).recipe).toMatchObject({
      notes: legacy,
      steps: ['Cook.'],
    });
  });
});

describe('leaving out ingredients', () => {
  const recipe = {
    ingredients: [{ item: 'chicken' }, { item: 'cream' }, { item: 'butter' }],
    steps: ['Brown the chicken.', 'Stir in the cream.', 'Melt the butter.'],
  };

  async function setIngredients(auth: string, mealId: number, excluded: string[]) {
    const meal = await getMeal(auth, mealId);
    const current = meal.recipe;
    if (!current) throw new Error('expected a recipe');
    const res = await request(app)
      .patch(`/meals/${mealId}`)
      .set('Authorization', auth)
      .send({
        recipe: {
          ...current,
          ingredients: current.ingredients.map((i) => ({
            ...i,
            excluded: excluded.includes(i.item),
          })),
        },
      })
      .expect(200);
    return MealSchema.parse(res.body);
  }

  const adjust = (auth: string, mealId: number) =>
    request(app).post(`/meals/${mealId}/recipe/adjust`).set('Authorization', auth);

  it('marks ingredients as left out, and adjusts the steps on request', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Tikka'), recipe });

    const marked = await setIngredients(auth, meal.id, ['cream']);
    expect(marked.recipe?.ingredients.map((i) => i.excluded)).toEqual([false, true, false]);
    expect(marked.recipe?.adjustedSteps).toBeNull();

    const res = await adjust(auth, meal.id).expect(200);
    const adjusted = MealSchema.parse(res.body).recipe;
    expect(adjusted?.adjustedSteps).toEqual({
      steps: ['Brown the chicken.', 'Melt the butter.'],
      leftOut: ['cream'],
    });
    // The original steps are kept.
    expect(adjusted?.steps).toEqual(recipe.steps);
    expect(adjusted && currentAdjustedSteps(adjusted)).toEqual([
      'Brown the chicken.',
      'Melt the butter.',
    ]);
  });

  it('treats adjusted steps as out of date once what’s left out changes', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Tikka'), recipe });
    await setIngredients(auth, meal.id, ['cream']);
    await adjust(auth, meal.id).expect(200);

    const changed = await setIngredients(auth, meal.id, ['cream', 'butter']);
    expect(changed.recipe && currentAdjustedSteps(changed.recipe)).toBeNull();

    const res = await adjust(auth, meal.id).expect(200);
    expect(MealSchema.parse(res.body).recipe?.adjustedSteps?.steps).toEqual(['Brown the chicken.']);
  });

  it('needs something left out', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, { name: unique('Tikka'), recipe });
    const res = await adjust(auth, meal.id).expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('nothing_left_out');
  });

  it('reports a failed rewrite and keeps the recipe as it was', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth, {
      name: unique('Tikka'),
      recipe: { ...recipe, steps: [...recipe.steps, 'FAIL'] },
    });
    await setIngredients(auth, meal.id, ['cream']);
    const res = await adjust(auth, meal.id).expect(502);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('ai_failed');
    expect((await getMeal(auth, meal.id)).recipe?.adjustedSteps).toBeNull();
  });

  it('says so when adjusting isn’t set up', async () => {
    const auth = await bearer(uniqueUserId());
    const created = await request(unread.app)
      .post('/meals')
      .set('Authorization', auth)
      .send({
        name: unique('Tikka'),
        recipe: { ...recipe, ingredients: [{ item: 'cream', excluded: true }] },
      })
      .expect(201);
    const res = await request(unread.app)
      .post(`/meals/${MealSchema.parse(created.body).id}/recipe/adjust`)
      .set('Authorization', auth)
      .expect(503);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('ai_unavailable');
  });

  it('reads recipes stored before ingredients could be left out', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    // As stored by the previous version: no `excluded`, no `adjustedSteps`.
    await db.orm.public.Meal.where({ id: meal.id }).update({
      recipe: {
        title: 'Old',
        servings: null,
        prepTime: null,
        cookTime: null,
        ingredients: [{ section: null, amount: '1', item: 'egg', note: null, excluded: false }],
        steps: ['Boil.'],
        notes: null,
      },
    });
    expect((await getMeal(auth, meal.id)).recipe).toMatchObject({
      title: 'Old',
      ingredients: [{ item: 'egg', excluded: false }],
      adjustedSteps: null,
    });
  });
});
