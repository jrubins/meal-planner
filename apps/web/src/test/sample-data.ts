import type { HouseholdMember, Meal, Night } from '@app/shared';

// Sample data for stories and component tests.

export const TODAY = '2026-11-24';
export const ME = 'user-alex';
export const MEMBERS: HouseholdMember[] = [
  { userId: ME, displayName: 'Alex' },
  { userId: 'user-sam', displayName: 'Sam' },
];

export function sampleMeal(id: number, name: string, overrides: Partial<Meal> = {}): Meal {
  return {
    id,
    name,
    tags: [],
    coverPhotoPath: null,
    description: null,
    recipeUrl: null,
    photos: [],
    lastEatenOn: null,
    timesEaten: 0,
    createdAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  };
}

export const TIKKA = sampleMeal(1, 'Chicken tikka masala', {
  tags: ['indian', 'chicken'],
  lastEatenOn: '2026-11-10',
});
export const TACOS = sampleMeal(2, 'Fish tacos', {
  tags: ['mexican', 'quick'],
  lastEatenOn: '2026-10-30',
});
export const RISOTTO = sampleMeal(3, 'Mushroom risotto', { tags: ['vegetarian'] });
export const CURRY = sampleMeal(4, 'Thai green curry', {
  tags: ['thai', 'spicy'],
  lastEatenOn: '2026-11-21',
});
export const MEALS: Meal[] = [TIKKA, TACOS, RISOTTO, CURRY];

const summary = (meal: Meal) => ({
  id: meal.id,
  name: meal.name,
  tags: meal.tags,
  coverPhotoPath: meal.coverPhotoPath,
});

export const PLANNED_NIGHT: Night = {
  date: TODAY,
  dinner: { date: TODAY, meal: summary(TIKKA), note: 'Make extra for lunch' },
  options: [],
};

export const VOTING_NIGHT: Night = {
  date: '2026-11-25',
  dinner: null,
  options: [
    {
      id: 11,
      date: '2026-11-25',
      meal: summary(TACOS),
      proposedByUserId: 'user-sam',
      votes: [
        { userId: 'user-sam', value: 'up' },
        { userId: ME, value: 'up' },
      ],
      chosen: false,
    },
    {
      id: 12,
      date: '2026-11-25',
      meal: summary(RISOTTO),
      proposedByUserId: 'user-sam',
      votes: [{ userId: 'user-sam', value: 'down' }],
      chosen: false,
    },
  ],
};

export const EMPTY_NIGHT: Night = { date: '2026-11-28', dinner: null, options: [] };
