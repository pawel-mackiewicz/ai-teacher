import { useState } from 'react';
import type { UseFlashcardsResult } from '../hooks/useFlashcards';
import type { Flashcard } from '../types/app';
import { getNextReviewIntervalFormatted } from '../srs';
import ReactMarkdown from 'react-markdown';
import './FlashcardsAllPanel.css';

interface FlashcardsAllPanelProps {
    flashcards: UseFlashcardsResult;
}

export function FlashcardsAllPanel({ flashcards }: FlashcardsAllPanelProps) {
    const { flashcards: allCards, deleteFlashcard, updateFlashcard } = flashcards;
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ front: string; back: string; topic: string }>({ front: '', back: '', topic: '' });

    // Group cards by topic (category)
    const groupedCards = allCards.reduce((acc, card) => {
        const topic = card.topic || 'Uncategorized';
        if (!acc[topic]) {
            acc[topic] = [];
        }
        acc[topic].push(card);
        return acc;
    }, {} as Record<string, Flashcard[]>);

    const topics = Object.keys(groupedCards).sort();

    const handleEditClick = (card: Flashcard) => {
        setEditingCardId(card.id);
        setEditForm({ front: card.front, back: card.back, topic: card.topic });
    };

    const handleCancelEdit = () => {
        setEditingCardId(null);
        setEditForm({ front: '', back: '', topic: '' });
    };

    const handleSaveEdit = (id: string) => {
        updateFlashcard(id, {
            front: editForm.front,
            back: editForm.back,
            topic: editForm.topic || 'Uncategorized'
        });
        setEditingCardId(null);
    };

    const handleDeleteClick = (id: string) => {
        if (window.confirm('Are you sure you want to delete this flashcard?')) {
            deleteFlashcard(id);
        }
    };

    if (allCards.length === 0) {
        return (
            <div className="flashcards-all-panel">
                <div className="empty-state">
                    <h3>No Flashcards Found</h3>
                    <p>You haven't generated or saved any flashcards yet.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flashcards-all-panel">
            <div className="flashcards-all-header">
                <h2>All Flashcards ({allCards.length})</h2>
            </div>
            <div className="flashcards-all-content">
                {topics.map(topic => (
                    <div key={topic} className="topic-group">
                        <h3 className="topic-header">{topic} <span className="topic-count">({groupedCards[topic].length})</span></h3>
                        <div className="cards-grid">
                            {groupedCards[topic].map(card => (
                                <div key={card.id} className="all-card-item">
                                    {editingCardId === card.id ? (
                                        <div className="card-edit-form">
                                            <div className="form-group">
                                                <label>Topic / Category</label>
                                                <input
                                                    type="text"
                                                    value={editForm.topic}
                                                    onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                                                    className="edit-input"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Front (Question)</label>
                                                <textarea
                                                    value={editForm.front}
                                                    onChange={(e) => setEditForm({ ...editForm, front: e.target.value })}
                                                    className="edit-textarea"
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label>Back (Answer)</label>
                                                <textarea
                                                    value={editForm.back}
                                                    onChange={(e) => setEditForm({ ...editForm, back: e.target.value })}
                                                    className="edit-textarea"
                                                />
                                            </div>
                                            <div className="card-actions edit-actions">
                                                <button className="btn-secondary" onClick={handleCancelEdit}>Cancel</button>
                                                <button className="btn-primary" onClick={() => handleSaveEdit(card.id)}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="card-content">
                                                <div className="card-side">
                                                    <strong>Q:</strong>
                                                    <div className="prose-small"><ReactMarkdown>{card.front}</ReactMarkdown></div>
                                                </div>
                                                <div className="card-side">
                                                    <strong>A:</strong>
                                                    <div className="prose-small"><ReactMarkdown>{card.back}</ReactMarkdown></div>
                                                </div>
                                            </div>
                                            <div className="card-meta">
                                                <span className="srs-badge">
                                                    Next: {getNextReviewIntervalFormatted(3, card)} {/* Using 3 as dummy rating just to show interval */}
                                                    {card.nextReviewDate <= Date.now() ? ' (Due)' : ''}
                                                </span>
                                                <div className="card-actions">
                                                    <button className="btn-icon" onClick={() => handleEditClick(card)} title="Edit">✏️</button>
                                                    <button className="btn-icon danger" onClick={() => handleDeleteClick(card.id)} title="Delete">🗑️</button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
