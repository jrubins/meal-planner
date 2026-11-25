import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.ts';
import { createRecipeReader, resolveModel } from '../src/features/meals/recipe-reader.ts';

// Choosing the provider and model only; nothing here calls a provider.

describe('choosing the AI provider and model', () => {
  it('defaults to Claude Opus 5.5 on Anthropic', () => {
    expect(resolveModel('anthropic', undefined)).toBe('claude-opus-5-5');
  });

  it('accepts any model of the chosen provider', () => {
    expect(resolveModel('anthropic', 'claude-haiku-5-5')).toBe('claude-haiku-5-5');
    expect(resolveModel('openai', 'gpt-5.2')).toBe('gpt-5.2');
    expect(resolveModel('gemini', 'gemini-2.5-flash')).toBe('gemini-2.5-flash');
  });

  it('requires a model for providers without a default', () => {
    expect(() => resolveModel('openai', undefined)).toThrow(
      /Set AI_MODEL to one of the openai models/,
    );
  });

  it("rejects another provider's model, listing the valid ones", () => {
    expect(() => resolveModel('gemini', 'claude-opus-5-5')).toThrow(
      /"claude-opus-5-5" is not a gemini model. Use one of: .*gemini-2.5-flash/,
    );
  });

  it('builds a reader for each provider', () => {
    for (const [provider, model] of [
      ['anthropic', undefined],
      ['openai', 'gpt-5.2'],
      ['gemini', 'gemini-2.5-flash'],
    ] as const) {
      expect(createRecipeReader({ provider, model, apiKey: 'test-key' })).toHaveProperty('read');
    }
  });

  it('refuses to start with a model the provider does not have', () => {
    const env = {
      DATABASE_URL: 'postgresql://localhost/app',
      AI_PROVIDER: 'openai',
      AI_API_KEY: 'test-key',
    };
    expect(() => loadConfig(env)).toThrow(/AI_MODEL/);
    expect(loadConfig({ ...env, AI_MODEL: 'gpt-5.2' }).AI_MODEL).toBe('gpt-5.2');
    // Without a key nothing is read, so no model is needed.
    expect(() => loadConfig({ ...env, AI_API_KEY: '' })).not.toThrow();
  });
});
