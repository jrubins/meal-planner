import { ApiErrorSchema, HouseholdSchema, MealSchema, type Household } from '@app/shared';
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

async function household(auth: string): Promise<Household> {
  const res = await request(app).get('/household').set('Authorization', auth).expect(200);
  return HouseholdSchema.parse(res.body);
}

describe('household API', () => {
  it('creates a household for a new user, with them as its only member', async () => {
    const { userId, auth } = await asNewUser();
    const mine = await household(auth);
    expect(mine.members).toEqual([{ userId, displayName: null }]);
    expect(mine.me).toBe(userId);
    expect(mine.inviteCode).toMatch(/^[A-Z2-9]{8}$/);
    // The same household on every request.
    expect((await household(auth)).id).toBe(mine.id);
  });

  it('updates the name, time zone and first day of the week', async () => {
    const { auth } = await asNewUser();
    const name = unique('The Kitchen');
    const res = await request(app)
      .patch('/household')
      .set('Authorization', auth)
      .send({ name, timeZone: 'America/New_York', weekStartsOn: 0 })
      .expect(200);
    expect(HouseholdSchema.parse(res.body)).toMatchObject({
      name,
      timeZone: 'America/New_York',
      weekStartsOn: 0,
    });
  });

  it('rejects an unknown time zone', async () => {
    const { auth } = await asNewUser();
    const res = await request(app)
      .patch('/household')
      .set('Authorization', auth)
      .send({ timeZone: 'Mars/Olympus_Mons' })
      .expect(400);
    expect(ApiErrorSchema.parse(res.body).error.code).toBe('validation_error');
  });

  it('sets my display name', async () => {
    const { userId, auth } = await asNewUser();
    const res = await request(app)
      .patch('/household/me')
      .set('Authorization', auth)
      .send({ displayName: 'Sam' })
      .expect(200);
    expect(HouseholdSchema.parse(res.body).members).toEqual([{ userId, displayName: 'Sam' }]);
  });

  it('lets a partner join with the invite code, bringing their meals along', async () => {
    const owner = await asNewUser();
    const partner = await asNewUser();
    const theirs = await household(owner.auth);
    const mealName = unique('Partner meal');
    const created = await request(app)
      .post('/meals')
      .set('Authorization', partner.auth)
      .send({ name: mealName })
      .expect(201);
    const meal = MealSchema.parse(created.body);

    const res = await request(app)
      .post('/household/join')
      .set('Authorization', partner.auth)
      .send({ inviteCode: theirs.inviteCode.toLowerCase() })
      .expect(200);

    const joined = HouseholdSchema.parse(res.body);
    expect(joined.id).toBe(theirs.id);
    expect(joined.members.map((m) => m.userId)).toEqual([owner.userId, partner.userId]);
    const ownerMeals = await request(app).get('/meals').set('Authorization', owner.auth);
    expect(
      MealSchema.array()
        .parse(ownerMeals.body)
        .map((m) => m.id),
    ).toContain(meal.id);
  });

  it('returns 404 for an unknown invite code', async () => {
    const { auth } = await asNewUser();
    await request(app)
      .post('/household/join')
      .set('Authorization', auth)
      .send({ inviteCode: 'NOPE0000' })
      .expect(404);
  });

  it('replaces the invite code so the old one stops working', async () => {
    const owner = await asNewUser();
    const stranger = await asNewUser();
    const before = await household(owner.auth);
    const res = await request(app)
      .post('/household/invite-code')
      .set('Authorization', owner.auth)
      .expect(200);
    expect(HouseholdSchema.parse(res.body).inviteCode).not.toBe(before.inviteCode);
    await request(app)
      .post('/household/join')
      .set('Authorization', stranger.auth)
      .send({ inviteCode: before.inviteCode })
      .expect(404);
  });
});
