import { SYSTEM_PROMPT } from './prompt';
import { addLog } from './logger';

export interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export interface FetchModelsResult {
  models: string[];
  warning?: string;
  usedFallback: boolean;
}

export interface ChatRequestContext {
  conversationId?: string;
  aiMessageId?: string;
  trigger?: 'send' | 'retry';
}

export interface SendMessageToAIOptions {
  firstTokenTimeoutMs?: number;
  betweenChunksTimeoutMs?: number;
  requestContext?: ChatRequestContext;
}

type ChatRequestErrorCategory =
  | 'first_token_timeout'
  | 'between_tokens_timeout'
  | 'auth_error'
  | 'http_error'
  | 'network_error'
  | 'empty_response'
  | 'unknown';

const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS = 100;
const DEFAULT_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS = 25;

const readTimeoutSecondsFromEnv = (key: string, fallbackSeconds: number): number => {
  const env = import.meta.env as Record<string, string | undefined>;
  const rawValue = env[key];
  if (!rawValue) return fallbackSeconds;

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackSeconds;

  return Math.round(parsed);
};

const toMs = (seconds: number): number => seconds * 1000;

export const CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS = toMs(
  readTimeoutSecondsFromEnv(
    'VITE_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS',
    DEFAULT_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS,
  ),
);
export const CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS = toMs(
  readTimeoutSecondsFromEnv(
    'VITE_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS',
    DEFAULT_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS,
  ),
);

let activeApiKey: string | null = null;
let activeModelId = DEFAULT_GEMINI_MODEL;

const normalizeModelName = (name: string): string => name.replace(/^models\//, '');

const isModelExperimental = (modelId: string): boolean => {
  const value = modelId.toLowerCase();
  return value.includes('experimental') || value.includes('-exp');
};

const supportsTextGeneration = (methods: unknown): boolean => {
  if (!Array.isArray(methods)) return false;
  return methods.includes('generateContent') || methods.includes('streamGenerateContent');
};

const uniqueSorted = (values: string[]): string[] => {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
};

const parseChunkText = (payload: unknown): string => {
  if (!payload || typeof payload !== 'object') return '';

  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return '';

  const firstCandidate = candidates[0] as { content?: { parts?: Array<{ text?: unknown }> } };
  const parts = firstCandidate.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
};

const toGeminiRole = (role: ChatMessage['role']): 'user' | 'model' => {
  return role === 'ai' ? 'model' : 'user';
};

const createRequestContents = (history: ChatMessage[], message: string) => {
  const normalizedHistory = history
    .filter((entry) => entry.content.trim().length > 0)
    .map((entry) => ({
      role: toGeminiRole(entry.role),
      parts: [{ text: entry.content }],
    }));

  normalizedHistory.push({
    role: 'user',
    parts: [{ text: message }],
  });

  return normalizedHistory;
};

const processSseResponse = async (response: Response, onChunk: (text: string) => void): Promise<string> => {
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json();
    const text = parseChunkText(payload);
    onChunk(text);
    return text;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Gemini response stream is unavailable.');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const payload = JSON.parse(data);
        const chunkText = parseChunkText(payload);
        if (chunkText) {
          fullText += chunkText;
          onChunk(fullText);
        }
      } catch {
        // Ignore malformed SSE chunks and continue processing stream.
      }
    }
  }

  return fullText;
};

class GeminiChatRequestError extends Error {
  category: ChatRequestErrorCategory;
  httpStatus?: number;

  constructor(message: string, category: ChatRequestErrorCategory, httpStatus?: number) {
    super(message);
    this.category = category;
    this.httpStatus = httpStatus;
    this.name = 'GeminiChatRequestError';
  }
}

const toTimeoutSeconds = (valueMs: number): number => Math.max(1, Math.round(valueMs / 1000));

const toAbortError = (
  category: 'first_token_timeout' | 'between_tokens_timeout',
  firstTokenTimeoutMs: number,
  betweenTokensTimeoutMs: number,
): GeminiChatRequestError => {
  if (category === 'first_token_timeout') {
    return new GeminiChatRequestError(
      `Gemini did not send the first response token within ${toTimeoutSeconds(firstTokenTimeoutMs)} seconds. Use "Retry from here" to try again.`,
      category,
    );
  }

  return new GeminiChatRequestError(
    `Gemini stopped streaming for more than ${toTimeoutSeconds(betweenTokensTimeoutMs)} seconds. Use "Retry from here" to try again.`,
    category,
  );
};

const normalizeChatRequestError = (
  error: unknown,
  abortCategory: 'first_token_timeout' | 'between_tokens_timeout' | null,
  firstTokenTimeoutMs: number,
  betweenTokensTimeoutMs: number,
): GeminiChatRequestError => {
  if (error instanceof GeminiChatRequestError) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    if (abortCategory) return toAbortError(abortCategory, firstTokenTimeoutMs, betweenTokensTimeoutMs);
    return new GeminiChatRequestError(
      'Gemini request was interrupted. Use "Retry from here" to try again.',
      'network_error',
    );
  }

  if (error instanceof TypeError) {
    return new GeminiChatRequestError(
      'Network error while contacting Gemini. Check your connection and retry.',
      'network_error',
    );
  }

  if (error instanceof Error) {
    return new GeminiChatRequestError(error.message || 'Gemini request failed.', 'unknown');
  }

  return new GeminiChatRequestError('Gemini request failed unexpectedly.', 'unknown');
};

export const initializeAI = (apiKey: string): void => {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) {
    throw new Error('Gemini API key is required.');
  }

  activeApiKey = normalizedKey;
};

export const setActiveModel = (modelId: string): void => {
  const normalizedModelId = modelId.trim();
  activeModelId = normalizedModelId || DEFAULT_GEMINI_MODEL;
};

export const getDefaultModel = (): string => DEFAULT_GEMINI_MODEL;

export const fetchGeminiModels = async (apiKey: string): Promise<FetchModelsResult> => {
  const normalizedKey = apiKey.trim();
  if (!normalizedKey) {
    throw new Error('Gemini API key is required.');
  }

  try {
    const response = await fetch(`${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(normalizedKey)}`);

    if (response.status === 401 || response.status === 403) {
      throw new Error('Invalid Gemini API key.');
    }

    if (!response.ok) {
      return {
        models: [DEFAULT_GEMINI_MODEL],
        usedFallback: true,
        warning: `Could not fetch model list (HTTP ${response.status}). Using fallback model ${DEFAULT_GEMINI_MODEL}.`,
      };
    }

    const payload = await response.json() as {
      models?: Array<{ name?: string; supportedGenerationMethods?: unknown }>;
    };

    const models = uniqueSorted(
      (payload.models || [])
        .filter((entry) => Boolean(entry.name))
        .filter((entry) => supportsTextGeneration(entry.supportedGenerationMethods))
        .map((entry) => normalizeModelName(entry.name as string))
        .filter((modelId) => modelId.startsWith('gemini'))
        .filter((modelId) => !isModelExperimental(modelId)),
    );

    if (models.length === 0) {
      return {
        models: [DEFAULT_GEMINI_MODEL],
        usedFallback: true,
        warning: `Gemini model list was empty. Using fallback model ${DEFAULT_GEMINI_MODEL}.`,
      };
    }

    return {
      models,
      usedFallback: false,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid Gemini API key.') {
      throw error;
    }

    return {
      models: [DEFAULT_GEMINI_MODEL],
      usedFallback: true,
      warning: `Could not fetch model list. Using fallback model ${DEFAULT_GEMINI_MODEL}.`,
    };
  }
};

export const sendMessageToAI = async (
  message: string,
  history: ChatMessage[],
  onChunk: (text: string) => void,
  options: SendMessageToAIOptions = {},
): Promise<string> => {
  if (!activeApiKey) {
    throw new Error('AI not initialized.');
  }

  const firstTokenTimeoutMs = options.firstTokenTimeoutMs ?? CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS;
  const betweenChunksTimeoutMs = options.betweenChunksTimeoutMs ?? CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS;
  const requestStartedAt = Date.now();

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: createRequestContents(history, message),
    generationConfig: {
      maxOutputTokens: 8192,
    },
  };

  addLog('llm_prompt', `Sending message to ${activeModelId}`, payload);

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModelId)}` +
    `:streamGenerateContent?alt=sse&key=${encodeURIComponent(activeApiKey)}`;

  const endpointForLogs = `models/${activeModelId}:streamGenerateContent`;
  const abortController = new AbortController();
  let streamTimer: ReturnType<typeof setTimeout> | undefined;
  let abortCategory: 'first_token_timeout' | 'between_tokens_timeout' | null = null;
  let hadPartialResponse = false;
  let firstTokenReceived = false;

  const scheduleStreamTimeout = (
    timeoutMs: number,
    nextCategory: 'first_token_timeout' | 'between_tokens_timeout',
  ) => {
    if (streamTimer) clearTimeout(streamTimer);
    streamTimer = setTimeout(() => {
      abortCategory = nextCategory;
      abortController.abort();
    }, timeoutMs);
  };

  const clearTimer = () => {
    if (streamTimer) clearTimeout(streamTimer);
  };

  scheduleStreamTimeout(firstTokenTimeoutMs, 'first_token_timeout');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: abortController.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new GeminiChatRequestError(
        'Gemini request was rejected. Check your API key and permissions.',
        'auth_error',
        response.status,
      );
    }

    if (!response.ok) {
      throw new GeminiChatRequestError(`Gemini request failed with status ${response.status}.`, 'http_error', response.status);
    }

    const fullText = await processSseResponse(response, (text) => {
      if (!firstTokenReceived) firstTokenReceived = true;
      scheduleStreamTimeout(betweenChunksTimeoutMs, 'between_tokens_timeout');
      if (text.trim().length > 0) hadPartialResponse = true;
      onChunk(text);
    });

    if (!fullText.trim()) {
      throw new GeminiChatRequestError(
        'Gemini returned an empty response. Use "Retry from here" to try again.',
        'empty_response',
      );
    }

    addLog('llm_response', `Received response from ${activeModelId}`, { text: fullText });
    return fullText;
  } catch (error) {
    const normalizedError = normalizeChatRequestError(
      error,
      abortCategory,
      firstTokenTimeoutMs,
      betweenChunksTimeoutMs,
    );
    const durationMs = Date.now() - requestStartedAt;

    addLog('error', `Gemini chat request failed (${normalizedError.category})`, {
      requestType: 'chat',
      modelId: activeModelId,
      endpoint: endpointForLogs,
      errorCategory: normalizedError.category,
      errorMessage: normalizedError.message,
      httpStatus: normalizedError.httpStatus,
      durationMs,
      hadPartialResponse,
      conversationId: options.requestContext?.conversationId,
      aiMessageId: options.requestContext?.aiMessageId,
      trigger: options.requestContext?.trigger,
    });

    throw normalizedError;
  } finally {
    clearTimer();
  }
};

export const generateFlashcards = async (
  topic: string,
  history: ChatMessage[],
): Promise<Array<{ front: string; back: string }>> => {
  if (!activeApiKey) {
    throw new Error('AI not initialized.');
  }

  const prompt = `Based on the preceding Socratic conversation about "${topic}", generate exactly 10 high-quality flashcards to help the user review and memorize the key concepts discussed.
You MUST respond with valid JSON ONLY.

JSON Format:
{
  "flashcards": [
    {
      "front": "Question or concept to remember",
      "back": "Detailed answer or explanation"
    }
  ]
}`;

  const payload = {
    systemInstruction: {
      parts: [{ text: "You are an expert AI educator. Output valid JSON ONLY." }],
    },
    contents: createRequestContents(history, prompt),
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  addLog('llm_prompt', `Generating flashcards using ${activeModelId}`, payload);

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(activeModelId)}` +
    `:generateContent?key=${encodeURIComponent(activeApiKey)}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}.`);
  }

  const data = await response.json();
  const text = parseChunkText(data);

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  addLog('llm_response', `Received flashcards response from ${activeModelId}`, { text });

  try {
    const parsed = JSON.parse(text);
    if (parsed.flashcards && Array.isArray(parsed.flashcards)) {
      return parsed.flashcards;
    }
    throw new Error('Invalid JSON schema returned.');
  } catch (err) {
    console.error("Failed to parse flashcards:", text, err);
    throw new Error('Failed to parse flashcards from AI response.');
  }
};
