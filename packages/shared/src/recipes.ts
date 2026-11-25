import { z } from 'zod';

// A meal's recipe, structured: read from recipe photos by an AI model, or typed in. Every
// field but the ingredients and steps is optional; amounts stay as written ("2 tbsp",
// "a pinch", "1½ cups") so a transcription never has to guess a number or a unit.

// --- The recipe as stored and returned: plain JSON, every field present ---------------------

const nullableText = z.string().nullable();

export const RecipeIngredientSchema = z.object({
  /** The group this ingredient is listed under, e.g. "For the sauce". */
  section: nullableText,
  /** As written: "2 tbsp", "400 g", "a pinch". */
  amount: nullableText,
  item: z.string(),
  /** e.g. "finely chopped", "or ghee". */
  note: nullableText,
});
export type RecipeIngredient = z.infer<typeof RecipeIngredientSchema>;

export const RecipeSchema = z.object({
  title: nullableText,
  servings: nullableText,
  prepTime: nullableText,
  cookTime: nullableText,
  ingredients: RecipeIngredientSchema.array(),
  steps: z.string().array(),
  notes: nullableText,
});
export type Recipe = z.infer<typeof RecipeSchema>;

// --- A recipe as written by people and models: fields may be left out; text is tidied -----

/** Trimmed text; empty or left out becomes null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null);

export const RecipeIngredientInputSchema = z.object({
  section: optionalText(100).describe('Group heading it is listed under, e.g. "For the sauce"'),
  amount: optionalText(60).describe('Quantity as written, e.g. "2 tbsp", "400 g", "a pinch"'),
  item: z.string().trim().min(1, 'Ingredient is required').max(200).describe('e.g. "garam masala"'),
  note: optionalText(200).describe('e.g. "finely chopped", "or ghee"'),
});
export type RecipeIngredientInput = z.input<typeof RecipeIngredientInputSchema>;

/** Parses to a Recipe. */
export const RecipeInputSchema = z.object({
  title: optionalText(150),
  servings: optionalText(60).describe('As written, e.g. "4", "4–6", "1 loaf"'),
  prepTime: optionalText(60).describe('e.g. "20 min"'),
  cookTime: optionalText(60).describe('e.g. "1 hr 10 min"'),
  ingredients: RecipeIngredientInputSchema.array().max(150).default([]),
  steps: z
    .array(z.string().trim().min(1, 'Step is required').max(3000))
    .max(150)
    .default([])
    .describe('In order, without numbers'),
  notes: optionalText(5000).describe('Tips, variations, storage'),
});
export type RecipeInput = z.input<typeof RecipeInputSchema>;

export const EMPTY_RECIPE: Recipe = {
  title: null,
  servings: null,
  prepTime: null,
  cookTime: null,
  ingredients: [],
  steps: [],
  notes: null,
};

/** True when a recipe holds nothing worth keeping. */
export function isEmptyRecipe(recipe: Recipe): boolean {
  return (
    !recipe.title &&
    !recipe.servings &&
    !recipe.prepTime &&
    !recipe.cookTime &&
    recipe.ingredients.length === 0 &&
    recipe.steps.length === 0 &&
    !recipe.notes
  );
}

/**
 * Adds one more page of a recipe (e.g. the next photo) to what's already there: its
 * ingredients and steps go after the existing ones, the title, servings and times fill in
 * only what's missing, and notes are kept from both.
 */
export function mergeRecipes(current: Recipe | null, page: Recipe): Recipe {
  if (!current) return page;
  return {
    title: current.title ?? page.title,
    servings: current.servings ?? page.servings,
    prepTime: current.prepTime ?? page.prepTime,
    cookTime: current.cookTime ?? page.cookTime,
    ingredients: [...current.ingredients, ...page.ingredients],
    steps: [...current.steps, ...page.steps],
    notes: [current.notes, page.notes].filter(Boolean).join('\n\n') || null,
  };
}

/** The recipe's words in one string, for search. */
export function recipeText(recipe: Recipe): string {
  return [
    recipe.title,
    ...recipe.ingredients.flatMap((i) => [i.section, i.amount, i.item, i.note]),
    ...recipe.steps,
    recipe.notes,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Ingredients in order, grouped under their sections (consecutive ones share a group). */
export function groupIngredients(
  ingredients: RecipeIngredient[],
): { section: string | null; items: RecipeIngredient[] }[] {
  const groups: { section: string | null; items: RecipeIngredient[] }[] = [];
  for (const ingredient of ingredients) {
    const last = groups.at(-1);
    if (last && last.section === ingredient.section) last.items.push(ingredient);
    else groups.push({ section: ingredient.section, items: [ingredient] });
  }
  return groups;
}
