import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { evaluateFlashcardAnswer, generateFlashcards } from '../ai-service';
import { FLASHCARDS_STORAGE_KEY } from '../constants/storage';
import {
  createFlashcardsFromGenerated,
  loadStoredFlashcards,
} from '../domain/flashcards';
import { addLog } from '../logger';
import { calculateNextSRSDelay, type SRSData } from '../srs';
import type { Conversation, Flashcard } from '../types/app';
import { getErrorMessage } from '../utils/error';

export type FlashcardRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface PendingFlashcardEvaluation {
  cardId: string;
  userAnswer: string;
  score: FlashcardRating;
  argumentation: string;
  tips: string[];
}

export interface UseFlashcardsResult {
  flashcards: Flashcard[];
  isFlashcardsView: boolean;
  setIsFlashcardsView: Dispatch<SetStateAction<boolean>>;
  isGeneratingFlashcards: boolean;
  currentCard: Flashcard | null;
  dueCardsCount: number;
  isEvaluatingAnswer: boolean;
  evaluationError: string | null;
  pendingEvaluation: PendingFlashcardEvaluation | null;
  requiresCorrection: boolean;
  isCorrectionSubmitted: boolean;
  correctedAnswer: string;
  generateForConversation: (conversation: Conversation | null) => Promise<void>;
  submitAnswerForEvaluation: (card: Flashcard, userAnswer: string) => Promise<void>;
  submitCorrection: (answer: string) => void;
  acceptEvaluationAndContinue: () => void;
  reviewFlashcard: (cardId: string, rating: FlashcardRating) => void;
}

export const useFlashcards = (): UseFlashcardsResult => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>(() => loadStoredFlashcards());
  const [isFlashcardsView, setIsFlashcardsView] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [currentStudyCardId, setCurrentStudyCardId] = useState<string | null>(null);
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState(false);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [pendingEvaluation, setPendingEvaluation] = useState<PendingFlashcardEvaluation | null>(null);
  const [isCorrectionSubmitted, setIsCorrectionSubmitted] = useState(false);
  const [correctedAnswer, setCorrectedAnswer] = useState('');

  const dueCards = flashcards.filter((card) => card.nextReviewDate <= Date.now());
  const currentCard = currentStudyCardId
    ? flashcards.find((card) => card.id === currentStudyCardId) || dueCards[0] || null
    : dueCards[0] || null;
  const currentCardId = currentCard?.id ?? null;
  const requiresCorrection = Boolean(pendingEvaluation && pendingEvaluation.score <= 3);

  useEffect(() => {
    localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(flashcards));
  }, [flashcards]);

  const resetEvaluationState = useCallback(() => {
    setIsEvaluatingAnswer(false);
    setEvaluationError(null);
    setPendingEvaluation(null);
    setIsCorrectionSubmitted(false);
    setCorrectedAnswer('');
  }, []);

  useEffect(() => {
    if (currentCardId && currentStudyCardId !== currentCardId) {
      setCurrentStudyCardId(currentCardId);
    }
  }, [currentCardId, currentStudyCardId]);

  useEffect(() => {
    resetEvaluationState();
  }, [currentCardId, resetEvaluationState]);

  const generateForConversation = useCallback(
    async (conversation: Conversation | null) => {
      if (!conversation || isGeneratingFlashcards) return;

      setIsGeneratingFlashcards(true);

      try {
        const topic = conversation.topic || conversation.title;
        const generated = await generateFlashcards(topic, conversation.messages);
        const newCards = createFlashcardsFromGenerated(generated, topic, conversation.id);

        setFlashcards((prev) => [...prev, ...newCards]);
        setIsFlashcardsView(true);
      } finally {
        setIsGeneratingFlashcards(false);
      }
    },
    [isGeneratingFlashcards],
  );

  const applyReviewRating = useCallback((cardId: string, rating: FlashcardRating, source: 'manual' | 'llm') => {
    setFlashcards((prev) =>
      prev.map((card) => {
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
        };
      }),
    );

    resetEvaluationState();
    setCurrentStudyCardId(null);
    addLog('action', `Reviewed flashcard ${cardId} with rating ${rating} via ${source}`);
  }, [resetEvaluationState]);

  const reviewFlashcard = useCallback((cardId: string, rating: FlashcardRating) => {
    applyReviewRating(cardId, rating, 'manual');
  }, [applyReviewRating]);

  const submitAnswerForEvaluation = useCallback(
    async (card: Flashcard, userAnswer: string) => {
      if (isEvaluatingAnswer) return;

      const trimmedAnswer = userAnswer.trim();
      if (!trimmedAnswer) {
        setEvaluationError('Please type an answer before requesting evaluation.');
        return;
      }

      setIsEvaluatingAnswer(true);
      setEvaluationError(null);
      setPendingEvaluation(null);
      setIsCorrectionSubmitted(false);
      setCorrectedAnswer('');

      try {
        const evaluation = await evaluateFlashcardAnswer(card.front, card.back, trimmedAnswer);

        if (currentCardId !== card.id) {
          return;
        }

        setPendingEvaluation({
          cardId: card.id,
          userAnswer: trimmedAnswer,
          score: evaluation.score,
          argumentation: evaluation.argumentation,
          tips: evaluation.tips,
        });
        addLog('action', `Evaluated flashcard ${card.id} with score ${evaluation.score}`);
      } catch (error) {
        setEvaluationError(getErrorMessage(error));
      } finally {
        setIsEvaluatingAnswer(false);
      }
    },
    [currentCardId, isEvaluatingAnswer],
  );

  const submitCorrection = useCallback((answer: string) => {
    if (!pendingEvaluation || pendingEvaluation.score > 3 || isCorrectionSubmitted) {
      return;
    }

    const trimmed = answer.trim();
    if (!trimmed) return;

    setCorrectedAnswer(trimmed);
    setIsCorrectionSubmitted(true);
    addLog('action', `Submitted corrected answer for flashcard ${pendingEvaluation.cardId}`);
  }, [isCorrectionSubmitted, pendingEvaluation]);

  const acceptEvaluationAndContinue = useCallback(() => {
    if (!pendingEvaluation) return;
    if (pendingEvaluation.score <= 3 && !isCorrectionSubmitted) return;

    applyReviewRating(pendingEvaluation.cardId, pendingEvaluation.score, 'llm');
  }, [applyReviewRating, isCorrectionSubmitted, pendingEvaluation]);

  return {
    flashcards,
    isFlashcardsView,
    setIsFlashcardsView,
    isGeneratingFlashcards,
    currentCard,
    dueCardsCount: dueCards.length,
    isEvaluatingAnswer,
    evaluationError,
    pendingEvaluation,
    requiresCorrection,
    isCorrectionSubmitted,
    correctedAnswer,
    generateForConversation,
    submitAnswerForEvaluation,
    submitCorrection,
    acceptEvaluationAndContinue,
    reviewFlashcard,
  };
};
