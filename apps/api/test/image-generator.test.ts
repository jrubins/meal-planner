import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';
import {
  createMealImageGenerator,
  resolveImageModel,
} from '../src/features/meals/image-generator.ts';

// Choosing the image provider and model only; nothing here calls a provider.

describe('choosing the image provider and model', () => {
  it('defaults to each provider’s low-cost model', () => {
    expect(resolveImageModel('openai', undefined)).toBe('gpt-image-2.5-flare');
    expect(resolveImageModel('gemini', undefined)).toBe('gemini-3.1-flash-lite-image');
  });

  it("rejects another provider's model, listing the valid ones", () => {
    expect(() => resolveImageModel('openai', 'gemini-3-pro-image')).toThrow(
      /"gemini-3-pro-image" is not one of the openai image models: .*gpt-image-2.5-flare/,
    );
  });

  it('builds a generator for each provider', () => {
    for (const provider of ['openai', 'gemini'] as const) {
      expect(
        createMealImageGenerator({ provider, model: undefined, quality: 'low', apiKey: 'key' }),
      ).toHaveProperty('generate');
    }
  });

  it('defaults to OpenAI at low quality, and refuses an unknown model', () => {
    const env = { DATABASE_URL: 'postgresql://localhost/app', IMAGE_API_KEY: 'test-key' };
    expect(loadConfig(env)).toMatchObject({ IMAGE_PROVIDER: 'openai', IMAGE_QUALITY: 'low' });
    expect(() => loadConfig({ ...env, IMAGE_MODEL: 'gpt-image-9' })).toThrow(/IMAGE_MODEL/);
    expect(() => loadConfig({ ...env, IMAGE_QUALITY: 'ultra' })).toThrow(/IMAGE_QUALITY/);
    // Without a key nothing is generated, so the model isn't checked.
    expect(() => loadConfig({ ...env, IMAGE_API_KEY: '', IMAGE_MODEL: 'x' })).not.toThrow();
  });
});
