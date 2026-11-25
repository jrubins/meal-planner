import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { PhotoContentType } from '@app/shared';
import { z } from 'zod';

/** What reading one photo found: the recipe as text, or that the photo shows no recipe. */
export type RecipeReading = { isRecipe: true; text: string } | { isRecipe: false };

/**
 * Reads a recipe from a photo (a cookbook page, a recipe card, a screenshot). The meals
 * service depends on this interface, so tests pass a fake and nothing calls Claude there.
 */
export interface RecipeReader {
  read(image: { contentType: PhotoContentType; data: Uint8Array }): Promise<RecipeReading>;
}

const ReadingSchema = z.object({
  is_recipe: z.boolean(),
  recipe: z.string(),
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

/** Reads recipe photos with Claude. */
export function createClaudeRecipeReader(apiKey: string): RecipeReader {
  const client = new Anthropic({ apiKey });
  return {
    async read({ contentType, data }) {
      const response = await client.beta.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        // Transcription needs little reasoning; low effort keeps it quick and cheap.
        output_config: { effort: 'low', format: betaZodOutputFormat(ReadingSchema) },
        // If the model declines (a safety classifier false positive on a recipe photo),
        // the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: contentType,
                  data: Buffer.from(data).toString('base64'),
                },
              },
              { type: 'text', text: INSTRUCTIONS },
            ],
          },
        ],
      });
      if (response.stop_reason === 'refusal') {
        throw new Error('The model declined to read this photo');
      }
      const reading = response.parsed_output;
      if (!reading) throw new Error(`No reading returned (stop reason ${response.stop_reason})`);
      const text = reading.recipe.trim();
      return reading.is_recipe && text ? { isRecipe: true, text } : { isRecipe: false };
    },
  };
}
