import type { HouseholdMember, Meal, Night, Recipe } from '@app/shared';

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
    recipe: null,
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

export const SAMPLE_RECIPE: Recipe = {
  title: 'Chicken tikka masala',
  servings: '4',
  prepTime: '20 min + overnight',
  cookTime: '40 min',
  ingredients: [
    {
      section: 'Marinade',
      amount: '600 g',
      item: 'chicken thighs',
      note: 'cut into chunks',
      excluded: false,
    },
    { section: 'Marinade', amount: '200 g', item: 'plain yogurt', note: null, excluded: false },
    { section: 'Marinade', amount: '1 tbsp', item: 'garam masala', note: null, excluded: false },
    { section: 'Sauce', amount: '2 tbsp', item: 'butter', note: 'or ghee', excluded: false },
    { section: 'Sauce', amount: '1', item: 'onion', note: 'finely chopped', excluded: false },
    { section: 'Sauce', amount: '400 g', item: 'crushed tomatoes', note: null, excluded: false },
    { section: 'Sauce', amount: '150 ml', item: 'double cream', note: null, excluded: false },
  ],
  steps: [
    'Mix the marinade ingredients with the chicken and leave overnight in the fridge.',
    'Grill the chicken until charred at the edges, about 10 minutes.',
    'Soften the onion in the butter, add the tomatoes and simmer for 15 minutes.',
    'Stir in the cream and the chicken and simmer for 5 more minutes.',
  ],
  notes: 'Serve with basmati rice and naan. Freezes well.',
  adjustedSteps: null,
};
