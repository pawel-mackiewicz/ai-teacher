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
        discardFlashcardDrafts
    } = flashcards;

    if (flashcardDrafts.length === 0) {
        return (
            <div className="flashcards-manage-panel">
                <div className="flashcards-manage-content">
                    <div className="no-cards">
                        <p>No draft flashcards to manage.</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flashcards-manage-panel">
            <div className="flashcards-manage-content">
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
                            className="btn-secondary btn-danger"
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
            </div>
        </div>
    );
}
