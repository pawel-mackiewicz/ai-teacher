import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  describeWords,
  enrichWordWithLLM,
  generateTopicWords,
  translateWords,
} from '../ai-service';
import {
  WORD_CARDS_STORAGE_KEY,
  WORD_NOTES_STORAGE_KEY,
  WORD_SETTINGS_STORAGE_KEY,
} from '../constants/storage';
import {
  buildWordKeySet,
  createWordCard,
  createWordNote,
  hasRequiredWordFields,
  loadStoredWordCards,
  loadStoredWordNotes,
  loadStoredWordSettings,
  normalizeWordKey,
  normalizeWordValue,
  type WordEntry,
} from '../domain/words';
import { addLog } from '../logger';
import { calculateNextSRSDelay, type SRSData } from '../srs';
import type { WordCard, WordNote, WordSettings } from '../types/app';
import { getErrorMessage } from '../utils/error';
import { createId } from '../utils/id';

export type WordReviewRating = 0 | 3 | 4 | 5;

export interface WordDraftEntry {
  id: string;
  word: string;
  definition: string;
  example: string;
  translation: string;
  topic: string | null;
  isDuplicate: boolean;
  isIncomplete: boolean;
}

type WordDraftField = 'word' | 'definition' | 'example' | 'translation';

export interface UseWordsResult {
  settings: WordSettings;
  dueCardsCount: number;
  totalCardsCount: number;
  currentCard: WordCard | null;
  currentNote: WordNote | null;
  isEnrichingWord: boolean;
  isGeneratingTopicWords: boolean;
  manualError: string | null;
  topicError: string | null;
  manualDraft: WordDraftEntry | null;
  topicDrafts: WordDraftEntry[];
  setTargetLanguage: (value: string) => void;
  setNativeLanguage: (value: string) => void;
  enrichWord: (word: string) => Promise<void>;
  updateManualDraft: (field: WordDraftField, value: string) => void;
  saveManualDraft: () => void;
  discardManualDraft: () => void;
  generateTopicDrafts: (topic: string, count: number) => Promise<void>;
  updateTopicDraft: (id: string, field: WordDraftField, value: string) => void;
  removeTopicDraft: (id: string) => void;
  saveTopicDrafts: () => void;
  clearTopicDrafts: () => void;
  reviewWordCard: (cardId: string, rating: WordReviewRating) => void;
}

const EMPTY_DRAFTS: WordDraftEntry[] = [];

const annotateDrafts = (drafts: Omit<WordDraftEntry, 'isDuplicate' | 'isIncomplete'>[], existingKeys: Set<string>): WordDraftEntry[] => {
  const seen = new Set<string>();

  return drafts.map((draft) => {
    const normalizedWord = normalizeWordValue(draft.word);
    const key = normalizeWordKey(normalizedWord);
    const isDuplicate = key.length > 0 && (existingKeys.has(key) || seen.has(key));
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
    }

    const normalizedDraft = {
      ...draft,
      word: normalizedWord,
      definition: draft.definition.trim(),
      example: draft.example.trim(),
      translation: draft.translation.trim(),
    };

    return {
      ...normalizedDraft,
      isDuplicate,
      isIncomplete: !hasRequiredWordFields(normalizedDraft),
    };
  });
};

const toDraft = (entry: WordEntry & { topic: string | null }): Omit<WordDraftEntry, 'isDuplicate' | 'isIncomplete'> => ({
  id: createId(),
  word: entry.word,
  definition: entry.definition,
  example: entry.example,
  translation: entry.translation,
  topic: entry.topic,
});

export const useWords = (): UseWordsResult => {
  const [settings, setSettings] = useState<WordSettings>(() => loadStoredWordSettings());
  const [notes, setNotes] = useState<WordNote[]>(() => loadStoredWordNotes());
  const [cards, setCards] = useState<WordCard[]>(() => loadStoredWordCards());
  const [isEnrichingWord, setIsEnrichingWord] = useState(false);
  const [isGeneratingTopicWords, setIsGeneratingTopicWords] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [topicError, setTopicError] = useState<string | null>(null);
  const [manualDraft, setManualDraft] = useState<WordDraftEntry | null>(null);
  const [topicDrafts, setTopicDrafts] = useState<WordDraftEntry[]>(EMPTY_DRAFTS);

  const existingWordKeys = useMemo(() => buildWordKeySet(notes), [notes]);

  const noteById = useMemo(() => {
    const map = new Map<string, WordNote>();
    notes.forEach((entry) => {
      map.set(entry.id, entry);
    });
    return map;
  }, [notes]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards
      .filter((card) => card.nextReviewDate <= now && noteById.has(card.noteId))
      .sort((left, right) => {
        if (left.nextReviewDate !== right.nextReviewDate) {
          return left.nextReviewDate - right.nextReviewDate;
        }
        return left.createdAt - right.createdAt;
      });
  }, [cards, noteById]);

  const currentCard = dueCards[0] || null;
  const currentNote = currentCard ? noteById.get(currentCard.noteId) || null : null;

  useEffect(() => {
    localStorage.setItem(WORD_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(WORD_NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    localStorage.setItem(WORD_CARDS_STORAGE_KEY, JSON.stringify(cards));
  }, [cards]);

  const setTargetLanguage = useCallback((value: string) => {
    setSettings((prev) => ({
      ...prev,
      targetLanguage: value,
    }));
  }, []);

  const setNativeLanguage = useCallback((value: string) => {
    setSettings((prev) => ({
      ...prev,
      nativeLanguage: value,
    }));
  }, []);

  const enrichWord = useCallback(
    async (word: string) => {
      if (isEnrichingWord) return;

      const normalizedWord = normalizeWordValue(word);
      if (!normalizedWord) {
        setManualError('Type a word before requesting enrichment.');
        return;
      }

      if (!settings.nativeLanguage.trim()) {
        setManualError('Set native language before enrichment.');
        return;
      }

      setManualError(null);
      setIsEnrichingWord(true);
      setManualDraft(null);

      try {
        const enriched = await enrichWordWithLLM(
          normalizedWord,
          settings.targetLanguage,
          settings.nativeLanguage,
        );
        const [annotated] = annotateDrafts(
          [toDraft({ ...enriched, topic: null })],
          existingWordKeys,
        );
        setManualDraft(annotated || null);
        addLog('action', `Enriched word "${normalizedWord}"`);
      } catch (error) {
        setManualError(getErrorMessage(error));
      } finally {
        setIsEnrichingWord(false);
      }
    },
    [existingWordKeys, isEnrichingWord, settings.nativeLanguage, settings.targetLanguage],
  );

  const updateManualDraft = useCallback(
    (field: WordDraftField, value: string) => {
      setManualDraft((prev) => {
        if (!prev) return prev;
        const next = {
          ...prev,
          [field]: value,
        };
        const [annotated] = annotateDrafts(
          [toDraft(next)],
          existingWordKeys,
        );
        return annotated || null;
      });
    },
    [existingWordKeys],
  );

  const discardManualDraft = useCallback(() => {
    setManualDraft(null);
    setManualError(null);
  }, []);

  const saveManualDraft = useCallback(() => {
    if (!manualDraft) return;

    if (manualDraft.isDuplicate) {
      setManualError('This word already exists in your deck.');
      return;
    }

    if (manualDraft.isIncomplete) {
      setManualError('Complete all required fields before saving.');
      return;
    }

    const note = createWordNote(manualDraft, manualDraft.topic);
    const card = createWordCard(note);

    setNotes((prev) => [...prev, note]);
    setCards((prev) => [...prev, card]);
    setManualDraft(null);
    setManualError(null);
    addLog('action', `Saved word "${note.word}"`);
  }, [manualDraft]);

  const generateTopicDrafts = useCallback(
    async (topic: string, count: number) => {
      if (isGeneratingTopicWords) return;

      const normalizedTopic = topic.trim().replace(/\s+/g, ' ');
      if (!normalizedTopic) {
        setTopicError('Topic is required.');
        return;
      }

      if (!settings.nativeLanguage.trim()) {
        setTopicError('Set native language before generating words.');
        return;
      }

      setTopicError(null);
      setIsGeneratingTopicWords(true);
      setTopicDrafts(EMPTY_DRAFTS);

      try {
        const requestedWords = await generateTopicWords(
          normalizedTopic,
          count,
          settings.targetLanguage,
        );

        const uniqueWords = requestedWords.filter((word, index, list) => {
          const key = normalizeWordKey(word);
          if (!key) return false;
          if (existingWordKeys.has(key)) return false;
          return list.findIndex((candidate) => normalizeWordKey(candidate) === key) === index;
        });

        if (uniqueWords.length === 0) {
          setTopicError('No new unique words were generated for this topic.');
          return;
        }

        const [translations, descriptions] = await Promise.all([
          translateWords(uniqueWords, settings.targetLanguage, settings.nativeLanguage),
          describeWords(uniqueWords, settings.targetLanguage),
        ]);

        const draftSeed = uniqueWords.map((word) => {
          const key = normalizeWordKey(word);
          const description = descriptions[key];

          return toDraft({
            word,
            translation: translations[key] || '',
            definition: description?.definition || '',
            example: description?.example || '',
            topic: normalizedTopic,
          });
        });

        const annotatedDrafts = annotateDrafts(draftSeed, existingWordKeys);
        setTopicDrafts(annotatedDrafts);
        addLog('action', `Generated ${annotatedDrafts.length} topic words for "${normalizedTopic}"`);
      } catch (error) {
        setTopicError(getErrorMessage(error));
      } finally {
        setIsGeneratingTopicWords(false);
      }
    },
    [
      existingWordKeys,
      isGeneratingTopicWords,
      settings.nativeLanguage,
      settings.targetLanguage,
    ],
  );

  const updateTopicDraft = useCallback(
    (id: string, field: WordDraftField, value: string) => {
      setTopicDrafts((prev) => {
        const updated = prev.map((draft) => (
          draft.id === id
            ? {
              ...draft,
              [field]: value,
            }
            : draft
        ));

        return annotateDrafts(updated.map((entry) => toDraft(entry)), existingWordKeys);
      });
    },
    [existingWordKeys],
  );

  const removeTopicDraft = useCallback((id: string) => {
    setTopicDrafts((prev) => {
      const updated = prev.filter((entry) => entry.id !== id);
      return annotateDrafts(updated.map((entry) => toDraft(entry)), existingWordKeys);
    });
  }, [existingWordKeys]);

  const clearTopicDrafts = useCallback(() => {
    setTopicDrafts(EMPTY_DRAFTS);
    setTopicError(null);
  }, []);

  const saveTopicDrafts = useCallback(() => {
    if (topicDrafts.length === 0) {
      setTopicError('No generated words to save.');
      return;
    }

    const validEntries = topicDrafts.filter((entry) => !entry.isDuplicate && !entry.isIncomplete);
    if (validEntries.length === 0) {
      setTopicError('No valid rows to save. Fix incomplete or duplicate rows first.');
      return;
    }

    const nextNotes = validEntries.map((entry) => createWordNote(entry, entry.topic));
    const nextCards = nextNotes.map((entry) => createWordCard(entry));

    setNotes((prev) => [...prev, ...nextNotes]);
    setCards((prev) => [...prev, ...nextCards]);
    setTopicDrafts(EMPTY_DRAFTS);
    setTopicError(null);
    addLog('action', `Saved ${nextNotes.length} generated words`);
  }, [topicDrafts]);

  const reviewWordCard = useCallback((cardId: string, rating: WordReviewRating) => {
    setCards((prev) => prev.map((card) => {
      if (card.id !== cardId) return card;

      const currentData: SRSData = {
        interval: card.interval,
        repetition: card.repetition,
        easinessFactor: card.easinessFactor,
      };
      const nextData = calculateNextSRSDelay(rating, currentData);

      return {
        ...card,
        ...nextData,
        updatedAt: Date.now(),
      };
    }));

    addLog('action', `Reviewed word card ${cardId} with rating ${rating}`);
  }, []);

  return {
    settings,
    dueCardsCount: dueCards.length,
    totalCardsCount: cards.length,
    currentCard,
    currentNote,
    isEnrichingWord,
    isGeneratingTopicWords,
    manualError,
    topicError,
    manualDraft,
    topicDrafts,
    setTargetLanguage,
    setNativeLanguage,
    enrichWord,
    updateManualDraft,
    saveManualDraft,
    discardManualDraft,
    generateTopicDrafts,
    updateTopicDraft,
    removeTopicDraft,
    saveTopicDrafts,
    clearTopicDrafts,
    reviewWordCard,
  };
};
