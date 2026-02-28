import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { addLogMock } = vi.hoisted(() => ({
  addLogMock: vi.fn(),
}));

vi.mock('./logger', () => ({
  addLog: addLogMock,
}));

import { initializeAI, sendMessageToAI, setActiveModel } from './ai-service';

const createAbortablePendingFetch = () =>
  vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      if (!signal) return;

      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'));
        return;
      }

      signal.addEventListener(
        'abort',
        () => {
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });
  });

const createSseResponseThatStallsAfterFirstChunk = (signal: AbortSignal): Response => {
  const encoder = new TextEncoder();
  const firstChunk = encoder.encode(
    'data: {"candidates":[{"content":{"parts":[{"text":"Chunk 1"}]}}]}\n\n',
  );
  let readCount = 0;

  const reader = {
    read: (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      if (readCount === 0) {
        readCount += 1;
        return Promise.resolve({ done: false, value: firstChunk });
      }

      return new Promise<ReadableStreamReadResult<Uint8Array>>((_resolve, reject) => {
        const onAbort = () => {
          reject(new DOMException('Aborted', 'AbortError'));
        };

        if (signal.aborted) {
          onAbort();
          return;
        }

        signal.addEventListener('abort', onAbort, { once: true });
      });
    },
  };

  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/event-stream' : null),
    },
    body: {
      getReader: () => reader,
    },
  } as unknown as Response;
};

const findErrorLogDetails = (): unknown => {
  const errorCall = addLogMock.mock.calls.find(([type]) => type === 'error');
  if (!errorCall) return null;
  return errorCall[2];
};

describe('sendMessageToAI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    initializeAI('secret-key');
    setActiveModel('gemini-2.5-flash');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('aborts with first-token timeout and logs structured error details', async () => {
    const fetchMock = createAbortablePendingFetch();
    vi.stubGlobal('fetch', fetchMock);

    const pending = sendMessageToAI('hello', [], vi.fn(), {
      firstTokenTimeoutMs: 30_000,
      betweenChunksTimeoutMs: 120_000,
      requestContext: {
        conversationId: 'conv-idle',
        aiMessageId: 'ai-idle',
        trigger: 'send',
      },
    });
    const assertion = expect(pending).rejects.toThrow('first response token within 30 seconds');

    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;

    expect(addLogMock).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('first_token_timeout'),
      expect.objectContaining({
        errorCategory: 'first_token_timeout',
        conversationId: 'conv-idle',
        aiMessageId: 'ai-idle',
        trigger: 'send',
      }),
    );

    const details = findErrorLogDetails();
    expect(details).not.toBeNull();
    expect(JSON.stringify(details)).not.toContain('secret-key');
  });

  it('aborts with between-tokens timeout and logs structured error details', async () => {
    const onChunk = vi.fn();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      if (!signal) {
        throw new Error('Missing abort signal');
      }
      return Promise.resolve(createSseResponseThatStallsAfterFirstChunk(signal));
    });

    vi.stubGlobal('fetch', fetchMock);

    const pending = sendMessageToAI('hello', [], onChunk, {
      firstTokenTimeoutMs: 150_000,
      betweenChunksTimeoutMs: 25_000,
      requestContext: {
        conversationId: 'conv-max',
        aiMessageId: 'ai-max',
        trigger: 'retry',
      },
    });
    const assertion = expect(pending).rejects.toThrow('more than 25 seconds');

    await vi.advanceTimersByTimeAsync(25_001);
    await assertion;
    expect(onChunk).toHaveBeenCalledWith('Chunk 1');

    expect(addLogMock).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('between_tokens_timeout'),
      expect.objectContaining({
        errorCategory: 'between_tokens_timeout',
        conversationId: 'conv-max',
        aiMessageId: 'ai-max',
        trigger: 'retry',
      }),
    );
  });

  it('logs http_error category and status when Gemini returns non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('failed', {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
        }),
      ),
    );

    await expect(sendMessageToAI('hello', [], vi.fn())).rejects.toThrow('status 500');

    expect(addLogMock).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('http_error'),
      expect.objectContaining({
        errorCategory: 'http_error',
        httpStatus: 500,
      }),
    );
  });

  it('logs network_error category when fetch fails before response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );

    await expect(sendMessageToAI('hello', [], vi.fn())).rejects.toThrow(
      'Network error while contacting Gemini',
    );

    expect(addLogMock).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('network_error'),
      expect.objectContaining({
        errorCategory: 'network_error',
      }),
    );
  });
});
