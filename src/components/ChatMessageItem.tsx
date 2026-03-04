import { useState, useLayoutEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types/app';
import './ChatMessageItem.css';

interface ChatMessageItemProps {
    message: Message;
    isGenerating: boolean;
    isLoading: boolean;
    onRetryMessage: (messageId: string) => void;
    onEditMessage: (messageId: string, newContent: string) => void;
}

export function ChatMessageItem({
    message,
    isGenerating,
    isLoading,
    onRetryMessage,
    onEditMessage,
}: ChatMessageItemProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(message.content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [editContent, isEditing]);

    const isAiError =
        message.role === 'ai' && message.content.includes('Use **Retry from here** on your message to try again.');

    const handleEditStart = () => {
        setIsEditing(true);
        setEditContent(message.content);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
    };

    const handleEditSave = () => {
        onEditMessage(message.id, editContent);
        setIsEditing(false);
    };

    return (
        <div className={`message ${message.role === 'user' ? 'user-message' : 'ai-message'} ${isAiError ? 'ai-message-error' : ''} ${isEditing ? 'is-editing' : ''}`}>
            <div className={`message-avatar ${isGenerating ? 'animate-pulse' : ''}`}>{message.role === 'user' ? 'U' : '🧠'}</div>
            <div className="message-content prose">
                {message.role === 'ai' ? (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                ) : isEditing ? (
                    <div className="message-edit-container">
                        <textarea
                            ref={textareaRef}
                            value={editContent}
                            className="message-edit-textarea"
                            onChange={(e) => setEditContent(e.target.value)}
                            disabled={isLoading}
                        />
                        <div className="message-actions">
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={handleEditSave}
                                disabled={!editContent.trim() || isLoading}
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleEditCancel}
                                disabled={isLoading}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                        <div className="message-actions">
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => onRetryMessage(message.id)}
                                disabled={isLoading}
                                aria-label="Retry from this message"
                                title="Retry from this message"
                            >
                                Retry from here
                            </button>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={handleEditStart}
                                disabled={isLoading}
                                aria-label="Edit this message"
                                title="Edit this message"
                            >
                                Edit
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
