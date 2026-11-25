import { detectImageMimeType, generateImage } from '@tanstack/ai';
import { createGeminiImage, GeminiImageModels } from '@tanstack/ai-gemini';
import { createOpenaiImage, OPENAI_IMAGE_MODELS } from '@tanstack/ai-openai';
import { PhotoContentTypeSchema, type PhotoContentType, type Recipe } from '@app/shared';

/** What a meal's image is made from: the meal as the household described it. */
export interface MealDetails {
  name: string;
  description: string | null;
  tags: readonly string[];
  recipe: Recipe | null;
}

export interface GeneratedImage {
  contentType: PhotoContentType;
  data: Uint8Array;
}

/**
 * Makes a picture of a meal from its details, for meals without a photo. The meals service
 * depends on this interface, so tests pass a fake and nothing calls a model there.
 */
export interface MealImageGenerator {
  generate(meal: MealDetails): Promise<GeneratedImage>;
}

/** The image providers meal pictures can be made with (TanStack AI adapters). */
export const IMAGE_PROVIDERS = ['openai', 'gemini'] as const;
export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

/** OpenAI's quality levels: cost and detail rise together. Gemini ignores it. */
export const IMAGE_QUALITIES = ['low', 'medium', 'high'] as const;
export type ImageQuality = (typeof IMAGE_QUALITIES)[number];

/** Each provider's models, and the default when IMAGE_MODEL isn't set. */
const PROVIDERS = {
  openai: { models: OPENAI_IMAGE_MODELS, defaultModel: 'gpt-image-2.5-flare' },
  gemini: { models: GeminiImageModels, defaultModel: 'gemini-3.1-flash-lite-image' },
} as const satisfies Record<ImageProvider, { models: readonly string[]; defaultModel: string }>;

/** The model a configuration generates with. Throws a readable error for an unusable one. */
export function resolveImageModel(provider: ImageProvider, model: string | undefined): string {
  const { models, defaultModel } = PROVIDERS[provider];
  const chosen = model ?? defaultModel;
  if (!(models as readonly string[]).includes(chosen)) {
    throw new Error(
      `IMAGE_MODEL "${chosen}" is not one of the ${provider} image models: ${models.join(', ')}`,
    );
  }
  return chosen;
}

const isModelOf = <T extends string>(models: readonly T[], model: string): model is T =>
  (models as readonly string[]).includes(model);

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/**
 * The prompt for a meal's picture: what the dish is (name, notes, tags, the ingredients the
 * household actually uses) and how it should look (a home-cooked dinner, no text or people).
 */
export function mealImagePrompt(meal: MealDetails): string {
  const ingredients = (meal.recipe?.ingredients ?? [])
    .filter((ingredient) => !ingredient.excluded)
    .map((ingredient) => ingredient.item.trim())
    .filter(Boolean)
    .slice(0, 20);
  const details = [
    meal.recipe?.title && meal.recipe.title !== meal.name ? `Recipe: ${meal.recipe.title}.` : null,
    meal.description?.trim() ? `Details: ${clip(meal.description.trim(), 600)}` : null,
    meal.tags.length > 0 ? `Tags: ${meal.tags.join(', ')}.` : null,
    ingredients.length > 0 ? `Main ingredients: ${ingredients.join(', ')}.` : null,
  ].filter(Boolean);

  return `A photo of a home-cooked dinner: ${meal.name}.
${details.length > 0 ? `\n${details.join(' ')}\n` : ''}
Style: natural, appetising food photography of the finished dish as a household would serve it at home, plated on an everyday plate or bowl on a kitchen table, soft daylight, shot from slightly above. Realistic portions. No text, labels, logos, hands or people.`;
}

export interface ImageConfig {
  provider: ImageProvider;
  /** A model of that provider; the provider's default when omitted. */
  model: string | undefined;
  quality: ImageQuality;
  apiKey: string;
}

/**
 * Makes meal pictures with any TanStack AI image provider. Switching provider, model or
 * quality is a configuration change (IMAGE_PROVIDER, IMAGE_MODEL, IMAGE_QUALITY, IMAGE_API_KEY).
 *
 * Each call should be one paid request: with OpenAI the client's automatic retries are off,
 * so a failure is reported rather than silently paid for again. (The Gemini adapter keeps its
 * client's defaults.)
 */
export function createMealImageGenerator({
  provider,
  model,
  quality,
  apiKey,
}: ImageConfig): MealImageGenerator {
  const chosen = resolveImageModel(provider, model);
  const client = { maxRetries: 0, timeout: 120_000 };

  async function generate(prompt: string) {
    const threadId = `meal-image-${crypto.randomUUID()}`;
    if (provider === 'openai' && isModelOf(OPENAI_IMAGE_MODELS, chosen)) {
      return generateImage({
        adapter: createOpenaiImage(chosen, apiKey, client),
        threadId,
        prompt,
        size: '1024x1024',
        modelOptions: { quality, output_format: 'jpeg' },
      });
    }
    if (provider === 'gemini' && isModelOf(GeminiImageModels, chosen)) {
      return generateImage({ adapter: createGeminiImage(chosen, apiKey), threadId, prompt });
    }
    throw new Error(`Unsupported image provider "${provider}"`);
  }

  return {
    async generate(meal) {
      const result = await generate(mealImagePrompt(meal));
      const image = result.images[0];
      if (!image?.b64Json) throw new Error('The image model returned no image data');
      const contentType = PhotoContentTypeSchema.safeParse(detectImageMimeType(image.b64Json));
      if (!contentType.success) throw new Error('The image model returned an unsupported format');
      return {
        contentType: contentType.data,
        data: new Uint8Array(Buffer.from(image.b64Json, 'base64')),
      };
    },
  };
}
