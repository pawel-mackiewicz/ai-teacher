import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import type { Message } from '../types/app';
import { ChatMessageItem } from './ChatMessageItem';
import './ChatPanel.css';


interface ChatPanelProps {
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onInputKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent) => void;
  onRetryMessage: (messageId: string) => void;
  onEditMessage: (messageId: string, newContent: string) => void;
}

export function ChatPanel({
  messages,
  inputValue,
  isLoading,
  onInputChange,
  onInputKeyDown,
  onSubmit,
  onRetryMessage,
  onEditMessage,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useLayoutEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to correctly measure scrollHeight
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);


  return (
    <>
      <div className="chat-area">
        <div className="message ai-message">
          <div className="message-avatar">🧠</div>
          <div className="message-content prose">
            <p>
              Greetings. I am your AI Teacher, here to help you construct a robust understanding of any topic, one
              solid brick at a time.
            </p>
            <p>
              What topic would you like to master today? What do you already know about it, and what is your primary
              goal?
            </p>
          </div>
        </div>

        {messages.map((message, index) => {
          const isGenerating = isLoading && message.role === 'ai' && index === messages.length - 1;

          return (
            <ChatMessageItem
              key={message.id}
              message={message}
              isGenerating={isGenerating}
              isLoading={isLoading}
              onRetryMessage={onRetryMessage}
              onEditMessage={onEditMessage}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <form className="input-form" onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            placeholder="Type your message here... (Shift+Enter for newline)"
            rows={1}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onInputKeyDown}
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
    </>
  );
}
