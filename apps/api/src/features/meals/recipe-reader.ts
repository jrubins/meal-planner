import { chat } from '@tanstack/ai';
import { ANTHROPIC_MODELS, createAnthropicChat } from '@tanstack/ai-anthropic';
import { createGeminiChat, GEMINI_MODELS } from '@tanstack/ai-gemini';
import { createOpenaiChat, OPENAI_CHAT_MODELS } from '@tanstack/ai-openai';
import type { PhotoContentType } from '@app/shared';
import { z } from 'zod';

/** What reading one photo found: the recipe as text, or that the photo shows no recipe. */
export type RecipeReading = { isRecipe: true; text: string } | { isRecipe: false };

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

const ReadingSchema = z.object({
  is_recipe: z.boolean().meta({ description: 'Whether the photo shows a recipe' }),
  recipe: z
    .string()
    .meta({ description: 'The transcribed recipe, or an empty string if there is none' }),
});

const INSTRUCTIONS = `This photo was uploaded to a household's meal planner as a picture of a recipe: a cookbook page, a handwritten card, a printout or a screenshot.

Transcribe the recipe into plain text so the household can read it later and an assistant can answer questions about it. Keep the recipe's own words and quantities; don't add, convert or improve anything. Lay it out as:

- the title on the first line, if the photo shows one
- servings, prep and cook times, if shown
- "Ingredients:" followed by one ingredient per line, starting with "- "
- "Steps:" followed by numbered steps
- any notes or tips from the page at the end

Use plain text only, no Markdown headings or bold. If part of the page is cut off or unreadable, transcribe what you can and add "[unreadable]" where text is missing.

If the photo does not show a recipe, set is_recipe to false and recipe to an empty string.`;

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
      const text = reading.recipe.trim();
      return reading.is_recipe && text ? { isRecipe: true, text } : { isRecipe: false };
    },
  };
}
