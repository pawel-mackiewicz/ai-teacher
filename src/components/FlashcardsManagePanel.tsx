import { useState } from 'react';
import type { UseFlashcardsResult } from '../hooks/useFlashcards';
import './FlashcardsManagePanel.css';

interface FlashcardsManagePanelProps {
    flashcards: UseFlashcardsResult;
}

export function FlashcardsManagePanel({ flashcards }: FlashcardsManagePanelProps) {
    const {
        flashcardDrafts,
        updateFlashcardDraft,
        removeFlashcardDraft,
        saveFlashcardDrafts,
        discardFlashcardDrafts,
        generateForTopic,
        isGeneratingTopicFlashcards,
        topicGenerationError,
        clearTopicGenerationError
    } = flashcards;

    const [topic, setTopic] = useState('');
    const [count, setCount] = useState(10);
    const [additionalInformation, setAdditionalInformation] = useState('');

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        await generateForTopic({ topic, count, additionalInformation });
    };

    return (
        <div className="flashcards-manage-panel">
            <div className="flashcards-manage-content">
                <section className="manage-section generator-section">
                    <h3>Generate Flashcards from Topic</h3>
                    <form className="generator-form" onSubmit={handleGenerate}>
                        <div className="form-group">
                            <label htmlFor="topic-input">Topic *</label>
                            <input
                                id="topic-input"
                                type="text"
                                className="draft-input"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                placeholder="E.g., Quantum Physics, Basic Spanish verbs..."
                                required
                                disabled={isGeneratingTopicFlashcards}
                            />
                        </div>
                        <div className="form-group count-group">
                            <label htmlFor="count-input">Count</label>
                            <input
                                id="count-input"
                                type="number"
                                className="draft-input count-input"
                                value={count}
                                onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 10)))}
                                min="1"
                                max="100"
                                disabled={isGeneratingTopicFlashcards}
                            />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="additional-input">Additional Information (Optional)</label>
                            <textarea
                                id="additional-input"
                                className="draft-textarea"
                                value={additionalInformation}
                                onChange={(e) => setAdditionalInformation(e.target.value)}
                                placeholder="Provide any specific context, styles, or focus areas..."
                                disabled={isGeneratingTopicFlashcards}
                            />
                        </div>
                        <div className="generator-actions full-width">
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={isGeneratingTopicFlashcards || !topic.trim()}
                            >
                                {isGeneratingTopicFlashcards ? 'Generating...' : 'Generate Flashcards'}
                            </button>
                        </div>
                    </form>

                    {topicGenerationError && (
                        <div className="error-banner">
                            <p>{topicGenerationError}</p>
                            <button type="button" className="btn-icon" onClick={clearTopicGenerationError}>✕</button>
                        </div>
                    )}
                </section>

                {flashcardDrafts.length > 0 && (
                    <section className="manage-section">
                        <h3>Review Generated Flashcards ({flashcardDrafts.length})</h3>
                        <div className="drafts-list">
                            {flashcardDrafts.map((draft) => (
                                <div key={draft.id} className="draft-card">
                                    <div className="draft-card-header">
                                        <button
                                            type="button"
                                            className="btn-icon"
                                            onClick={() => removeFlashcardDraft(draft.id)}
                                            title="Remove flashcard"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="draft-fields">
                                        <div className="form-group">
                                            <label>Front (Question)</label>
                                            <textarea
                                                className="draft-textarea"
                                                value={draft.front}
                                                onChange={(e) => updateFlashcardDraft(draft.id, 'front', e.target.value)}
                                                placeholder="Question..."
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Back (Answer)</label>
                                            <textarea
                                                className="draft-textarea"
                                                value={draft.back}
                                                onChange={(e) => updateFlashcardDraft(draft.id, 'back', e.target.value)}
                                                placeholder="Answer..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="manage-actions">
                            <button
                                type="button"
                                className="btn-danger"
                                onClick={discardFlashcardDrafts}
                            >
                                Discard All
                            </button>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={saveFlashcardDrafts}
                            >
                                Save All Flashcards
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
