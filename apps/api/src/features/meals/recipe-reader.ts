import { chat } from '@tanstack/ai';
import { ANTHROPIC_MODELS, createAnthropicChat } from '@tanstack/ai-anthropic';
import { createGeminiChat, GEMINI_MODELS } from '@tanstack/ai-gemini';
import { createOpenaiChat, OPENAI_CHAT_MODELS } from '@tanstack/ai-openai';
import { isEmptyRecipe, RecipeInputSchema, type PhotoContentType, type Recipe } from '@app/shared';
import { z } from 'zod';

/** What reading one photo found: the recipe on it, or that the photo shows no recipe. */
export type RecipeReading = { isRecipe: true; recipe: Recipe } | { isRecipe: false };

/**
 * Reads a recipe from a photo (a cookbook page, a recipe card, a screenshot). The meals
 * service depends on this interface, so tests pass a fake and nothing calls a model there.
 */
export interface RecipeReader {
  read(image: { contentType: PhotoContentType; data: Uint8Array }): Promise<RecipeReading>;
}

/** The AI providers recipe photos can be read with (TanStack AI adapters). */
export const AI_PROVIDERS = ['anthropic', 'openai', 'gemini'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Each provider's models, and the default when AI_MODEL isn't set (null: AI_MODEL required). */
const PROVIDERS = {
  anthropic: { models: ANTHROPIC_MODELS, defaultModel: 'claude-opus-5-5' },
  openai: { models: OPENAI_CHAT_MODELS, defaultModel: null },
  gemini: { models: GEMINI_MODELS, defaultModel: null },
} as const satisfies Record<AiProvider, { models: readonly string[]; defaultModel: string | null }>;

/**
 * What the model fills in. Every field is present (null when the page doesn't show it): the
 * most portable shape for providers' structured output. RecipeInputSchema then tidies it.
 */
const nullableText = (description: string) => z.string().nullable().meta({ description });
const ReadingSchema = z.object({
  is_recipe: z.boolean().meta({ description: 'Whether the photo shows a recipe' }),
  title: nullableText('The recipe title, if shown'),
  servings: nullableText('Servings or yield as written, e.g. "4", "4–6", "1 loaf"'),
  prep_time: nullableText('Prep time as written, e.g. "20 min"'),
  cook_time: nullableText('Cook time as written, e.g. "40 min"'),
  ingredients: z
    .array(
      z.object({
        section: nullableText('Group heading it is listed under, e.g. "For the sauce"'),
        amount: nullableText('Quantity as written, e.g. "2 tbsp", "400 g", "a pinch"'),
        item: z.string().meta({ description: 'The ingredient, e.g. "garam masala"' }),
        note: nullableText('Preparation or alternatives, e.g. "finely chopped", "or ghee"'),
      }),
    )
    .meta({ description: 'In the order shown' }),
  steps: z.array(z.string()).meta({ description: 'In order, one entry per step, without numbers' }),
  notes: nullableText('Tips, variations or storage notes from the page'),
});

const INSTRUCTIONS = `This photo was uploaded to a household's meal planner as a picture of a recipe: a cookbook page, a handwritten card, a printout or a screenshot.

Transcribe the recipe into the structured fields so the household can read it later and an assistant can answer questions about it. Keep the recipe's own words and quantities: don't add, convert or improve anything, and keep amounts exactly as written ("2 tbsp", "a pinch"). Use null for anything the page doesn't show. When ingredients are grouped under headings ("For the sauce"), give each one its heading as its section.

If the photo shows only part of a recipe (for example the second page), transcribe that part. If part of the page is cut off or unreadable, transcribe what you can and write "[unreadable]" where text is missing.

If the photo does not show a recipe, set is_recipe to false and leave the other fields empty.`;

export interface AiConfig {
  provider: AiProvider;
  /** A model of that provider; the provider's default when omitted. */
  model: string | undefined;
  apiKey: string;
}

/** The model a configuration reads with. Throws a readable error for an unusable one. */
export function resolveModel(provider: AiProvider, model: string | undefined): string {
  const { models, defaultModel } = PROVIDERS[provider];
  const chosen = model ?? defaultModel;
  if (!chosen)
    throw new Error(`Set AI_MODEL to one of the ${provider} models: ${models.join(', ')}`);
  if (!(models as readonly string[]).includes(chosen)) {
    throw new Error(
      `AI_MODEL "${chosen}" is not a ${provider} model. Use one of: ${models.join(', ')}`,
    );
  }
  return chosen;
}

const isModelOf = <T extends string>(models: readonly T[], model: string): model is T =>
  (models as readonly string[]).includes(model);

/**
 * Reads recipe photos with any TanStack AI provider. Switching provider or model is a
 * configuration change (AI_PROVIDER, AI_MODEL, AI_API_KEY); the prompt and schema are shared.
 */
export function createRecipeReader({ provider, model, apiKey }: AiConfig): RecipeReader {
  const chosen = resolveModel(provider, model);

  // Each provider's adapter is typed by its own model list, so each is built in its own branch.
  const adapter =
    provider === 'anthropic' && isModelOf(ANTHROPIC_MODELS, chosen)
      ? createAnthropicChat(chosen, apiKey)
      : provider === 'openai' && isModelOf(OPENAI_CHAT_MODELS, chosen)
        ? createOpenaiChat(chosen, apiKey)
        : provider === 'gemini' && isModelOf(GEMINI_MODELS, chosen)
          ? createGeminiChat(chosen, apiKey)
          : null;
  if (!adapter) throw new Error(`Unsupported AI provider "${provider}"`);

  return {
    async read({ contentType, data }) {
      const reading = await chat({
        adapter,
        threadId: `recipe-${crypto.randomUUID()}`,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'data',
                  value: Buffer.from(data).toString('base64'),
                  mimeType: contentType,
                },
              },
              { type: 'text', content: INSTRUCTIONS },
            ],
          },
        ],
        outputSchema: ReadingSchema,
      });
      if (!reading.is_recipe) return { isRecipe: false };
      // Normalises the model's output: trims, drops blank ingredients and steps, applies limits.
      const recipe = RecipeInputSchema.parse({
        title: reading.title,
        servings: reading.servings,
        prepTime: reading.prep_time,
        cookTime: reading.cook_time,
        ingredients: reading.ingredients.filter((i) => i.item.trim()),
        steps: reading.steps.filter((step) => step.trim()),
        notes: reading.notes,
      });
      return isEmptyRecipe(recipe) ? { isRecipe: false } : { isRecipe: true, recipe };
    },
  };
}
