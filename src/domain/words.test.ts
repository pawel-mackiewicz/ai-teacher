import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORD_CARDS_STORAGE_KEY,
  WORD_NOTES_STORAGE_KEY,
  WORD_SETTINGS_STORAGE_KEY,
} from '../constants/storage';
import {
  DEFAULT_WORD_SETTINGS,
  buildWordKeySet,
  createWordCard,
  createWordNote,
  loadStoredWordCards,
  loadStoredWordNotes,
  loadStoredWordSettings,
  normalizeWordKey,
} from './words';

interface StorageMock {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const createLocalStorageMock = (): StorageMock => {
  const store: Record<string, string> = {};

  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((key) => {
        delete store[key];
      });
    },
  };
};

describe('words domain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T12:00:00.000Z'));
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('falls back to default settings when settings storage is invalid', () => {
    localStorage.setItem(WORD_SETTINGS_STORAGE_KEY, '{broken');
    expect(loadStoredWordSettings()).toEqual(DEFAULT_WORD_SETTINGS);
  });

  it('normalizes word key for deduplication', () => {
    expect(normalizeWordKey('  Hello!  ')).toBe('hello');
    expect(normalizeWordKey('Hello   World')).toBe('hello world');
  });

  it('builds key set from notes', () => {
    const notes = [
      createWordNote(
        {
          word: 'Hello',
          definition: 'A greeting.',
          example: 'Hello there.',
          translation: 'Czesc',
        },
        null,
      ),
      createWordNote(
        {
          word: 'World',
          definition: 'Earth.',
          example: 'The world is round.',
          translation: 'Swiat',
        },
        'Geography',
      ),
    ];

    expect(buildWordKeySet(notes)).toEqual(new Set(['hello', 'world']));
  });

  it('creates word card with default SRS values', () => {
    const note = createWordNote(
      {
        word: 'Closure',
        definition: 'A function with access to its lexical scope.',
        example: 'Closures capture variables from parent scope.',
        translation: 'Domkniecie',
      },
      'JavaScript',
    );

    const card = createWordCard(note);
    expect(card).toMatchObject({
      noteId: note.id,
      template: 'meaning',
      front: 'Closure',
      interval: 0,
      repetition: 0,
      easinessFactor: 2.5,
      nextReviewDate: Date.now(),
    });
    expect(card.back).toContain('Definition');
    expect(card.back).toContain('Translation');
    expect(card.back).toContain('Example');
  });

  it('loads valid notes and cards from storage', () => {
    const storedNotes = [
      {
        id: 'n1',
        word: 'Array',
        definition: 'Ordered collection.',
        example: 'An array stores multiple values.',
        translation: 'Tablica',
        topic: 'JavaScript',
        createdAt: 10,
        updatedAt: 20,
      },
    ];
    const storedCards = [
      {
        id: 'c1',
        noteId: 'n1',
        template: 'meaning',
        front: 'Array',
        back: 'Definition...',
        interval: 1,
        repetition: 2,
        easinessFactor: 2.5,
        nextReviewDate: 100,
        createdAt: 10,
        updatedAt: 20,
      },
    ];

    localStorage.setItem(WORD_NOTES_STORAGE_KEY, JSON.stringify(storedNotes));
    localStorage.setItem(WORD_CARDS_STORAGE_KEY, JSON.stringify(storedCards));

    expect(loadStoredWordNotes()).toHaveLength(1);
    expect(loadStoredWordCards()).toHaveLength(1);
  });
});
