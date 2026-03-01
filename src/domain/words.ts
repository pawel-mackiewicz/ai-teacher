import {
  WORD_CARDS_STORAGE_KEY,
  WORD_NOTES_STORAGE_KEY,
  WORD_SETTINGS_STORAGE_KEY,
} from '../constants/storage';
import type { WordCard, WordNote, WordSettings } from '../types/app';
import { createId } from '../utils/id';

export interface WordEntry {
  word: string;
  definition: string;
  example: string;
  translation: string;
}

export const DEFAULT_WORD_SETTINGS: WordSettings = {
  targetLanguage: 'English',
  nativeLanguage: 'English',
};

const normalizeWhitespace = (value: string): string => value.trim().replace(/\s+/g, ' ');

export const normalizeWordValue = (value: string): string => normalizeWhitespace(value);

export const normalizeWordKey = (value: string): string => {
  const collapsed = normalizeWordValue(value).toLowerCase();
  return collapsed.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
};

const toWordCardBack = (entry: WordEntry): string => {
  return `**Definition:** ${entry.definition}\n\n**Translation:** ${entry.translation}\n\n**Example:** ${entry.example}`;
};

const toNumberOrNow = (value: unknown): number => {
  return Number.isFinite(value) ? Number(value) : Date.now();
};

export const loadStoredWordSettings = (): WordSettings => {
  const raw = localStorage.getItem(WORD_SETTINGS_STORAGE_KEY);
  if (!raw) return DEFAULT_WORD_SETTINGS;

  try {
    const parsed = JSON.parse(raw) as Partial<WordSettings>;
    const targetLanguage = typeof parsed.targetLanguage === 'string'
      ? normalizeWhitespace(parsed.targetLanguage)
      : '';
    const nativeLanguage = typeof parsed.nativeLanguage === 'string'
      ? normalizeWhitespace(parsed.nativeLanguage)
      : '';

    return {
      targetLanguage: targetLanguage || DEFAULT_WORD_SETTINGS.targetLanguage,
      nativeLanguage: nativeLanguage || DEFAULT_WORD_SETTINGS.nativeLanguage,
    };
  } catch {
    return DEFAULT_WORD_SETTINGS;
  }
};

export const loadStoredWordNotes = (): WordNote[] => {
  const raw = localStorage.getItem(WORD_NOTES_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        const word = typeof entry.word === 'string' ? normalizeWordValue(entry.word) : '';
        const definition = typeof entry.definition === 'string' ? normalizeWhitespace(entry.definition) : '';
        const example = typeof entry.example === 'string' ? normalizeWhitespace(entry.example) : '';
        const translation = typeof entry.translation === 'string' ? normalizeWhitespace(entry.translation) : '';
        const topicValue = typeof entry.topic === 'string' ? normalizeWhitespace(entry.topic) : '';

        return {
          id: typeof entry.id === 'string' && entry.id ? entry.id : createId(),
          word,
          definition,
          example,
          translation,
          topic: topicValue || null,
          createdAt: toNumberOrNow(entry.createdAt),
          updatedAt: toNumberOrNow(entry.updatedAt),
        };
      })
      .filter((entry) => entry.word.length > 0);
  } catch {
    return [];
  }
};

export const loadStoredWordCards = (): WordCard[] => {
  const raw = localStorage.getItem(WORD_CARDS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map((entry) => {
        return {
          id: typeof entry.id === 'string' && entry.id ? entry.id : createId(),
          noteId: typeof entry.noteId === 'string' ? entry.noteId : '',
          template: 'meaning' as const,
          front: typeof entry.front === 'string' ? entry.front : '',
          back: typeof entry.back === 'string' ? entry.back : '',
          interval: Number.isFinite(entry.interval) ? Number(entry.interval) : 0,
          repetition: Number.isFinite(entry.repetition) ? Number(entry.repetition) : 0,
          easinessFactor: Number.isFinite(entry.easinessFactor) ? Number(entry.easinessFactor) : 2.5,
          nextReviewDate: Number.isFinite(entry.nextReviewDate) ? Number(entry.nextReviewDate) : Date.now(),
          createdAt: toNumberOrNow(entry.createdAt),
          updatedAt: toNumberOrNow(entry.updatedAt),
        };
      })
      .filter((entry) => entry.noteId.length > 0 && entry.front.length > 0 && entry.back.length > 0);
  } catch {
    return [];
  }
};

export const hasRequiredWordFields = (entry: WordEntry): boolean => {
  return (
    normalizeWordValue(entry.word).length > 0 &&
    normalizeWhitespace(entry.definition).length > 0 &&
    normalizeWhitespace(entry.example).length > 0 &&
    normalizeWhitespace(entry.translation).length > 0
  );
};

export const buildWordKeySet = (notes: WordNote[]): Set<string> => {
  return new Set(
    notes
      .map((entry) => normalizeWordKey(entry.word))
      .filter((key) => key.length > 0),
  );
};

export const createWordNote = (entry: WordEntry, topic: string | null): WordNote => {
  const now = Date.now();
  return {
    id: createId(),
    word: normalizeWordValue(entry.word),
    definition: normalizeWhitespace(entry.definition),
    example: normalizeWhitespace(entry.example),
    translation: normalizeWhitespace(entry.translation),
    topic: topic ? normalizeWhitespace(topic) : null,
    createdAt: now,
    updatedAt: now,
  };
};

export const createWordCard = (note: WordNote): WordCard => {
  const now = Date.now();

  return {
    id: createId(),
    noteId: note.id,
    template: 'meaning',
    front: note.word,
    back: toWordCardBack(note),
    interval: 0,
    repetition: 0,
    easinessFactor: 2.5,
    nextReviewDate: now,
    createdAt: now,
    updatedAt: now,
  };
};
