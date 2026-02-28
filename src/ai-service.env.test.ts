import { afterEach, describe, expect, it, vi } from 'vitest';

const loadServiceModule = async () => {
  vi.resetModules();
  return import('./ai-service');
};

describe('ai-service timeout env configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses default timeout values when env vars are missing', async () => {
    const service = await loadServiceModule();

    expect(service.CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS).toBe(100_000);
    expect(service.CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS).toBe(25_000);
  });

  it('reads timeout values from seconds env vars and converts them to milliseconds', async () => {
    vi.stubEnv('VITE_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS', '12');
    vi.stubEnv('VITE_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS', '7');

    const service = await loadServiceModule();

    expect(service.CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS).toBe(12_000);
    expect(service.CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS).toBe(7_000);
  });

  it('falls back to defaults for invalid timeout env var values', async () => {
    vi.stubEnv('VITE_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS', '0');
    vi.stubEnv('VITE_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS', 'invalid');

    const service = await loadServiceModule();

    expect(service.CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS).toBe(100_000);
    expect(service.CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS).toBe(25_000);
  });
});
