import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatMessage } from '../ai-service';
import { ChatMessageItem } from './ChatMessageItem';
import './ChatPanel.css'; // Reuse chat panel styles
import './EphemeralChat.css';

interface EphemeralChatProps {
    messages: (ChatMessage & { id: string })[];
    inputValue: string;
    isLoading: boolean;
    onInputChange: (value: string) => void;
    onSubmit: (e?: FormEvent) => void;
    onRetryMessage: (id: string) => void;
    onClose: () => void;
}

export function EphemeralChat({
    messages,
    inputValue,
    isLoading,
    onInputChange,
    onSubmit,
    onRetryMessage,
    onClose,
}: EphemeralChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        // Scroll to bottom when messages change
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useLayoutEffect(() => {
        if (textareaRef.current) {
            // Auto-resize textarea
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [inputValue]);

    const handleInputKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handleSubmit = (e?: FormEvent) => {
        if (e) e.preventDefault();
        onSubmit();
    };

    return (
        <div className="ephemeral-chat-container">
            <div className="ephemeral-chat-header">
                <div className="ephemeral-chat-title">
                    <span className="setup-icon">🧠</span> Master Restorer
                </div>
                <button
                    className="ephemeral-chat-close"
                    onClick={onClose}
                    aria-label="Close chat"
                    title="Close chat"
                >
                    ×
                </button>
            </div>

            <div className="ephemeral-chat-area chat-area">
                {messages.map((message, index) => {
                    const isGenerating = isLoading && message.role === 'ai' && index === messages.length - 1;

                    // Ephemeral chat doesn't support edit, but we support retry
                    return (
                        <ChatMessageItem
                            key={message.id}
                            message={message}
                            isGenerating={isGenerating}
                            isLoading={isLoading}
                            onRetryMessage={onRetryMessage}
                            onEditMessage={() => { }}
                        />
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className="ephemeral-input-area input-area">
                <form className="input-form" onSubmit={handleSubmit}>
                    <textarea
                        ref={textareaRef}
                        placeholder="Type your message here... (Shift+Enter for newline)"
                        rows={1}
                        value={inputValue}
                        onChange={(e) => onInputChange(e.target.value)}
                        onKeyDown={handleInputKeyDown}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        className="btn-send"
                        aria-label="Send Message"
                        disabled={!inputValue.trim() || isLoading}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
