import {
  ApiErrorSchema,
  MealSchema,
  NightSchema,
  ShuffleWeekResultSchema,
  WeekSchema,
  type Meal,
  type Night,
} from '@app/shared';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { bearer, createTestApp, unique, uniqueUserId } from './helpers.ts';

const { app, db } = createTestApp();

afterAll(async () => {
  await db.close();
});

async function asNewUser() {
  const userId = uniqueUserId();
  return { userId, auth: await bearer(userId) };
}

async function createMeal(auth: string, name = unique('Meal')): Promise<Meal> {
  const res = await request(app)
    .post('/meals')
    .set('Authorization', auth)
    .send({ name })
    .expect(201);
  return MealSchema.parse(res.body);
}

async function propose(auth: string, date: string, mealIds: number[]): Promise<Night> {
  const res = await request(app)
    .post('/plan/options')
    .set('Authorization', auth)
    .send({ date, mealIds })
    .expect(201);
  return NightSchema.parse(res.body);
}

describe('week plan', () => {
  it('shows the seven nights of a Monday week', async () => {
    const { auth, userId } = await asNewUser();
    // 2026-11-25 is a Wednesday.
    const res = await request(app)
      .get('/plan/weeks/2026-11-25')
      .set('Authorization', auth)
      .expect(200);
    const week = WeekSchema.parse(res.body);
    expect(week.start).toBe('2026-11-23');
    expect(week.end).toBe('2026-11-29');
    expect(week.nights.map((n) => n.date)).toHaveLength(7);
    expect(week.nights.every((n) => n.dinner === null && n.options.length === 0)).toBe(true);
    expect(week.members.map((m) => m.userId)).toEqual([userId]);
  });

  it('follows the household’s first day of the week', async () => {
    const { auth } = await asNewUser();
    await request(app).patch('/household').set('Authorization', auth).send({ weekStartsOn: 0 });
    const res = await request(app).get('/plan/weeks/2026-11-25').set('Authorization', auth);
    expect(WeekSchema.parse(res.body).start).toBe('2026-11-22');
  });

  it('plans, replaces and clears a dinner', async () => {
    const { auth } = await asNewUser();
    const first = await createMeal(auth);
    const second = await createMeal(auth);
    const path = '/plan/nights/2026-11-24/dinner';

    await request(app).put(path).set('Authorization', auth).send({ mealId: first.id }).expect(200);
    const replaced = await request(app)
      .put(path)
      .set('Authorization', auth)
      .send({ mealId: second.id, note: 'Double batch' })
      .expect(200);
    expect(NightSchema.parse(replaced.body).dinner).toMatchObject({
      meal: { id: second.id, name: second.name },
      note: 'Double batch',
    });

    const week = WeekSchema.parse(
      (await request(app).get('/plan/weeks/2026-11-24').set('Authorization', auth)).body,
    );
    expect(week.nights[1]?.dinner?.meal?.id).toBe(second.id);

    const cleared = await request(app).delete(path).set('Authorization', auth).expect(200);
    expect(NightSchema.parse(cleared.body).dinner).toBeNull();
  });

  it('plans a night with just a note', async () => {
    const { auth } = await asNewUser();
    const res = await request(app)
      .put('/plan/nights/2026-11-27/dinner')
      .set('Authorization', auth)
      .send({ note: 'Eating out' })
      .expect(200);
    expect(NightSchema.parse(res.body).dinner).toEqual({
      date: '2026-11-27',
      meal: null,
      note: 'Eating out',
    });
  });

  it('needs a meal or a note', async () => {
    const { auth } = await asNewUser();
    const res = await request(app)
      .put('/plan/nights/2026-11-27/dinner')
      .set('Authorization', auth)
      .send({ note: '  ' })
      .expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('validation_error');
  });

  it("refuses another household's meal", async () => {
    const owner = await asNewUser();
    const other = await asNewUser();
    const meal = await createMeal(owner.auth);
    await request(app)
      .put('/plan/nights/2026-11-24/dinner')
      .set('Authorization', other.auth)
      .send({ mealId: meal.id })
      .expect(404);
  });
});

describe('dinner options and votes', () => {
  it('proposes options for a night, once each', async () => {
    const { auth, userId } = await asNewUser();
    const a = await createMeal(auth);
    const b = await createMeal(auth);
    await propose(auth, '2026-11-25', [a.id]);
    const night = await propose(auth, '2026-11-25', [a.id, b.id]);
    expect(night.options.map((o) => o.meal.id)).toEqual([a.id, b.id]);
    expect(night.options[0]).toMatchObject({ proposedByUserId: userId, votes: [], chosen: false });
  });

  it('lets each member vote, change their vote and take it back', async () => {
    const owner = await asNewUser();
    const partner = await asNewUser();
    const { inviteCode } = (await request(app).get('/household').set('Authorization', owner.auth))
      .body as { inviteCode: string };
    await request(app)
      .post('/household/join')
      .set('Authorization', partner.auth)
      .send({ inviteCode })
      .expect(200);

    const meal = await createMeal(owner.auth);
    const [option] = (await propose(owner.auth, '2026-11-26', [meal.id])).options;
    if (!option) throw new Error('expected an option');
    const vote = (auth: string, value: string) =>
      request(app)
        .put(`/plan/options/${option.id}/vote`)
        .set('Authorization', auth)
        .send({ vote: value })
        .expect(200)
        .then((res) => NightSchema.parse(res.body).options[0]?.votes);

    await vote(owner.auth, 'up');
    expect(await vote(partner.auth, 'down')).toEqual([
      { userId: owner.userId, value: 'up' },
      { userId: partner.userId, value: 'down' },
    ]);
    expect(await vote(partner.auth, 'up')).toEqual([
      { userId: owner.userId, value: 'up' },
      { userId: partner.userId, value: 'up' },
    ]);
    expect(await vote(owner.auth, 'none')).toEqual([{ userId: partner.userId, value: 'up' }]);
  });

  it("chooses an option as the night's dinner, keeping the others", async () => {
    const { auth } = await asNewUser();
    const a = await createMeal(auth);
    const b = await createMeal(auth);
    const night = await propose(auth, '2026-11-28', [a.id, b.id]);
    const optionB = night.options.find((o) => o.meal.id === b.id);
    if (!optionB) throw new Error('expected an option');

    const res = await request(app)
      .post(`/plan/options/${optionB.id}/choose`)
      .set('Authorization', auth)
      .expect(200);
    const chosen = NightSchema.parse(res.body);
    expect(chosen.dinner?.meal?.id).toBe(b.id);
    expect(chosen.options.map((o) => [o.meal.id, o.chosen])).toEqual([
      [a.id, false],
      [b.id, true],
    ]);
  });

  it('removes an option', async () => {
    const { auth } = await asNewUser();
    const meal = await createMeal(auth);
    const [option] = (await propose(auth, '2026-11-29', [meal.id])).options;
    const res = await request(app)
      .delete(`/plan/options/${option?.id}`)
      .set('Authorization', auth)
      .expect(200);
    expect(NightSchema.parse(res.body).options).toEqual([]);
  });

  it("hides other households' options", async () => {
    const owner = await asNewUser();
    const other = await asNewUser();
    const meal = await createMeal(owner.auth);
    const [option] = (await propose(owner.auth, '2026-11-29', [meal.id])).options;
    await request(app)
      .put(`/plan/options/${option?.id}/vote`)
      .set('Authorization', other.auth)
      .send({ vote: 'down' })
      .expect(404);
    await request(app)
      .delete(`/plan/options/${option?.id}`)
      .set('Authorization', other.auth)
      .expect(404);
  });
});

describe('shuffle week', () => {
  it('adds options to empty nights only, never repeating a meal', async () => {
    const { auth } = await asNewUser();
    const meals = await Promise.all(Array.from({ length: 12 }, () => createMeal(auth)));
    const planned = meals[0];
    if (!planned) throw new Error('expected meals');
    await request(app)
      .put('/plan/nights/2027-01-04/dinner')
      .set('Authorization', auth)
      .send({ mealId: planned.id })
      .expect(200);

    const res = await request(app)
      .post('/plan/weeks/2027-01-06/shuffle')
      .set('Authorization', auth)
      .send({ optionsPerNight: 1 })
      .expect(200);
    const { week, added } = ShuffleWeekResultSchema.parse(res.body);

    expect(added).toHaveLength(6);
    expect(week.nights[0]?.options).toEqual([]);
    const ids = week.nights.flatMap((n) => n.options.map((o) => o.meal.id));
    expect(new Set(ids).size).toBe(6);
    expect(ids).not.toContain(planned.id);
  });

  it('asks for meals first when the library is empty', async () => {
    const { auth } = await asNewUser();
    const res = await request(app)
      .post('/plan/weeks/2027-01-06/shuffle')
      .set('Authorization', auth)
      .send({})
      .expect(409);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('no_meals');
  });
});
