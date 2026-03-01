export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  topic: string | null;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  topic: string;
  conversationId: string;
  interval: number;
  repetition: number;
  easinessFactor: number;
  nextReviewDate: number;
}

export interface WordSettings {
  targetLanguage: string;
  nativeLanguage: string;
}

export interface WordNote {
  id: string;
  word: string;
  definition: string;
  example: string;
  translation: string;
  topic: string | null;
  createdAt: number;
  updatedAt: number;
}

export type WordCardTemplate = 'meaning';

export interface WordCard {
  id: string;
  noteId: string;
  template: WordCardTemplate;
  front: string;
  back: string;
  interval: number;
  repetition: number;
  easinessFactor: number;
  nextReviewDate: number;
  createdAt: number;
  updatedAt: number;
}
