import { describe, expect, it } from 'vitest';
import { EMPTY_RECIPE, groupIngredients, mergeRecipes, RecipeInputSchema } from './recipes.ts';

const recipe = (input: object) => RecipeInputSchema.parse(input);

describe('recipes', () => {
  it('adds a second page after the first', () => {
    const first = recipe({
      title: 'Lasagne',
      ingredients: [{ item: 'pasta' }],
      steps: ['Boil.'],
      notes: 'Freezes well.',
    });
    const second = recipe({
      title: 'Ignored',
      servings: '6',
      ingredients: [{ item: 'cheese' }],
      steps: ['Bake.'],
      notes: 'Use a deep dish.',
    });
    expect(mergeRecipes(first, second)).toEqual({
      ...EMPTY_RECIPE,
      title: 'Lasagne',
      servings: '6',
      ingredients: [
        { section: null, amount: null, item: 'pasta', note: null },
        { section: null, amount: null, item: 'cheese', note: null },
      ],
      steps: ['Boil.', 'Bake.'],
      notes: 'Freezes well.\n\nUse a deep dish.',
    });
    expect(mergeRecipes(null, second)).toBe(second);
  });

  it('groups consecutive ingredients by section', () => {
    const { ingredients } = recipe({
      ingredients: [
        { section: 'Marinade', item: 'yogurt' },
        { section: 'Marinade', item: 'lemon' },
        { section: 'Sauce', item: 'tomato' },
        { item: 'rice' },
      ],
    });
    expect(groupIngredients(ingredients).map((g) => [g.section, g.items.length])).toEqual([
      ['Marinade', 2],
      ['Sauce', 1],
      [null, 1],
    ]);
  });
});
