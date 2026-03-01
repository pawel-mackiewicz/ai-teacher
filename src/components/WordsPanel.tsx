import { useState, type FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import type { WordReviewRating } from '../hooks/useWords';
import type { WordCard, WordNote, WordSettings } from '../types/app';
import type { WordDraftEntry } from '../hooks/useWords';
import './WordsPanel.css';

interface WordsPanelProps {
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
  onSetTargetLanguage: (value: string) => void;
  onSetNativeLanguage: (value: string) => void;
  onEnrichWord: (word: string) => Promise<void>;
  onUpdateManualDraft: (field: 'word' | 'definition' | 'example' | 'translation', value: string) => void;
  onSaveManualDraft: () => void;
  onDiscardManualDraft: () => void;
  onGenerateTopicDrafts: (topic: string, count: number) => Promise<void>;
  onUpdateTopicDraft: (id: string, field: 'word' | 'definition' | 'example' | 'translation', value: string) => void;
  onRemoveTopicDraft: (id: string) => void;
  onSaveTopicDrafts: () => void;
  onClearTopicDrafts: () => void;
  onReviewWordCard: (cardId: string, rating: WordReviewRating) => void;
}

const ratingButtons: Array<{ label: string; rating: WordReviewRating }> = [
  { label: 'Again', rating: 0 },
  { label: 'Hard', rating: 3 },
  { label: 'Good', rating: 4 },
  { label: 'Easy', rating: 5 },
];

const validDraftRows = (drafts: WordDraftEntry[]): number => drafts.filter((entry) => !entry.isDuplicate && !entry.isIncomplete).length;

export function WordsPanel({
  settings,
  dueCardsCount,
  totalCardsCount,
  currentCard,
  currentNote,
  isEnrichingWord,
  isGeneratingTopicWords,
  manualError,
  topicError,
  manualDraft,
  topicDrafts,
  onSetTargetLanguage,
  onSetNativeLanguage,
  onEnrichWord,
  onUpdateManualDraft,
  onSaveManualDraft,
  onDiscardManualDraft,
  onGenerateTopicDrafts,
  onUpdateTopicDraft,
  onRemoveTopicDraft,
  onSaveTopicDrafts,
  onClearTopicDrafts,
  onReviewWordCard,
}: WordsPanelProps) {
  const [manualWordInput, setManualWordInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topicCountInput, setTopicCountInput] = useState(30);
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const isBackVisible = Boolean(currentCard && revealedCardId === currentCard.id);

  const handleManualEnrich = (event: FormEvent) => {
    event.preventDefault();
    void onEnrichWord(manualWordInput);
  };

  const handleGenerateTopic = (event: FormEvent) => {
    event.preventDefault();
    void onGenerateTopicDrafts(topicInput, topicCountInput);
  };

  return (
    <div className="words-panel">
      <section className="words-card words-settings">
        <h3>Word Settings</h3>
        <div className="words-settings-grid">
          <label>
            Target language
            <input
              value={settings.targetLanguage}
              onChange={(event) => onSetTargetLanguage(event.target.value)}
              placeholder="English"
            />
          </label>
          <label>
            Native language
            <input
              value={settings.nativeLanguage}
              onChange={(event) => onSetNativeLanguage(event.target.value)}
              placeholder="Polish"
            />
          </label>
        </div>
      </section>

      <section className="words-card">
        <h3>Add One Word</h3>
        <form className="words-inline-form" onSubmit={handleManualEnrich}>
          <input
            value={manualWordInput}
            onChange={(event) => setManualWordInput(event.target.value)}
            placeholder="Type a word..."
          />
          <button className="btn-primary" type="submit" disabled={isEnrichingWord}>
            {isEnrichingWord ? 'Generating...' : 'Generate Fields'}
          </button>
        </form>
        {manualError ? <p className="words-error">{manualError}</p> : null}

        {manualDraft ? (
          <div className="words-draft-editor">
            <h4>Manual Draft</h4>
            <label>
              Word
              <input
                value={manualDraft.word}
                onChange={(event) => onUpdateManualDraft('word', event.target.value)}
              />
            </label>
            <label>
              Translation
              <input
                value={manualDraft.translation}
                onChange={(event) => onUpdateManualDraft('translation', event.target.value)}
              />
            </label>
            <label>
              Definition
              <textarea
                rows={3}
                value={manualDraft.definition}
                onChange={(event) => onUpdateManualDraft('definition', event.target.value)}
              />
            </label>
            <label>
              Example
              <textarea
                rows={3}
                value={manualDraft.example}
                onChange={(event) => onUpdateManualDraft('example', event.target.value)}
              />
            </label>
            {manualDraft.isDuplicate ? (
              <p className="words-warning">This word is a duplicate and cannot be saved.</p>
            ) : null}
            {manualDraft.isIncomplete ? (
              <p className="words-warning">Fill all fields before saving.</p>
            ) : null}
            <div className="words-action-row">
              <button className="btn-primary" onClick={onSaveManualDraft} type="button">
                Save Word
              </button>
              <button className="btn-secondary" onClick={onDiscardManualDraft} type="button">
                Discard
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="words-card">
        <h3>Generate Words From Topic</h3>
        <form className="words-inline-form words-topic-form" onSubmit={handleGenerateTopic}>
          <input
            value={topicInput}
            onChange={(event) => setTopicInput(event.target.value)}
            placeholder="Topic (for example: travel)"
          />
          <input
            className="words-count-input"
            type="number"
            min={1}
            max={100}
            value={topicCountInput}
            onChange={(event) => setTopicCountInput(Number(event.target.value))}
          />
          <button className="btn-primary" type="submit" disabled={isGeneratingTopicWords}>
            {isGeneratingTopicWords ? 'Generating...' : 'Generate'}
          </button>
        </form>
        {topicError ? <p className="words-error">{topicError}</p> : null}

        {topicDrafts.length > 0 ? (
          <div className="words-preview">
            <div className="words-preview-header">
              <h4>Preview ({topicDrafts.length})</h4>
              <span>{validDraftRows(topicDrafts)} valid rows</span>
            </div>

            <div className="words-preview-list">
              {topicDrafts.map((row) => (
                <div className="words-preview-row" key={row.id}>
                  <input
                    value={row.word}
                    onChange={(event) => onUpdateTopicDraft(row.id, 'word', event.target.value)}
                    placeholder="Word"
                  />
                  <input
                    value={row.translation}
                    onChange={(event) => onUpdateTopicDraft(row.id, 'translation', event.target.value)}
                    placeholder="Translation"
                  />
                  <input
                    value={row.definition}
                    onChange={(event) => onUpdateTopicDraft(row.id, 'definition', event.target.value)}
                    placeholder="Definition"
                  />
                  <input
                    value={row.example}
                    onChange={(event) => onUpdateTopicDraft(row.id, 'example', event.target.value)}
                    placeholder="Example"
                  />
                  <button className="btn-secondary" type="button" onClick={() => onRemoveTopicDraft(row.id)}>
                    Remove
                  </button>
                  {row.isDuplicate ? <span className="words-row-tag duplicate">Duplicate</span> : null}
                  {row.isIncomplete ? <span className="words-row-tag incomplete">Incomplete</span> : null}
                </div>
              ))}
            </div>

            <div className="words-action-row">
              <button className="btn-primary" type="button" onClick={onSaveTopicDrafts}>
                Save Valid Rows
              </button>
              <button className="btn-secondary" type="button" onClick={onClearTopicDrafts}>
                Clear Preview
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="words-card words-review">
        <div className="words-review-header">
          <h3>Review</h3>
          <p>{dueCardsCount} due / {totalCardsCount} total</p>
        </div>

        {currentCard && currentNote ? (
          <div className="words-review-card">
            <h4>{currentNote.word}</h4>
            {!isBackVisible ? (
              <button
                className="btn-primary"
                type="button"
                onClick={() => setRevealedCardId(currentCard.id)}
              >
                Show Answer
              </button>
            ) : (
              <>
                <div className="words-review-back">
                  <ReactMarkdown>{currentCard.back}</ReactMarkdown>
                </div>
                <div className="words-rating-row">
                  {ratingButtons.map((entry) => (
                    <button
                      key={entry.rating}
                      className="srs-btn"
                      type="button"
                      onClick={() => {
                        setRevealedCardId(null);
                        onReviewWordCard(currentCard.id, entry.rating);
                      }}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="words-empty">No due word cards right now.</p>
        )}
      </section>
    </div>
  );
}
