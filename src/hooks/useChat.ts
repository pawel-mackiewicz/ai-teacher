import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS,
  CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS,
  sendMessageToAI,
  type ChatMessage,
} from '../ai-service';
import { editMessageContent, resetConversationForRetry, toConversationTitle } from '../domain/conversations';
import { addLog } from '../logger';
import type { Conversation, Message } from '../types/app';
import { getErrorMessage } from '../utils/error';
import { createId } from '../utils/id';

interface UseChatParams {
  activeConversation: Conversation | null;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
}

export interface UseChatResult {
  inputValue: string;
  setInputValue: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  timeoutRemainingMs: number | null;
  sendMessage: (e?: FormEvent) => Promise<void>;
  retryMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => void;
  handleInputEnter: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

interface StreamReplyParams {
  conversationId: string;
  aiMessageId: string;
  userText: string;
  historyBeforeSend: ChatMessage[];
  trigger: 'send' | 'retry';
}

const toChatHistory = (messages: Message[]): ChatMessage[] =>
  messages.map((entry) => ({
    role: entry.role,
    content: entry.content,
  }));

export const useChat = ({
  activeConversation,
  setConversations,
}: UseChatParams): UseChatResult => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeoutDeadline, setTimeoutDeadline] = useState<number | null>(null);
  const [timeoutRemainingMs, setTimeoutRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (timeoutDeadline === null) {
      setTimeoutRemainingMs(null);
      return;
    }

    const updateRemaining = () => {
      setTimeoutRemainingMs(Math.max(0, timeoutDeadline - Date.now()));
    };

    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => {
      window.clearInterval(timerId);
    };
  }, [timeoutDeadline]);

  const streamReply = useCallback(
    async ({ conversationId, aiMessageId, userText, historyBeforeSend, trigger }: StreamReplyParams) => {
      setIsLoading(true);
      setTimeoutDeadline(Date.now() + CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS);
      setTimeoutRemainingMs(CHAT_STREAM_FIRST_TOKEN_TIMEOUT_MS);

      try {
        await sendMessageToAI(
          userText,
          historyBeforeSend,
          (chunk) => {
            setTimeoutDeadline(Date.now() + CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS);
            setTimeoutRemainingMs(CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_MS);

            setConversations((prev) =>
              prev.map((conversation) => {
                if (conversation.id !== conversationId) return conversation;

                return {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === aiMessageId ? { ...message, content: chunk } : message,
                  ),
                  updatedAt: Date.now(),
                };
              }),
            );
          },
          {
            requestContext: {
              conversationId,
              aiMessageId,
              trigger,
            },
          },
        );
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        setConversations((prev) =>
          prev.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;

            return {
              ...conversation,
              messages: conversation.messages.map((message) => {
                if (message.id !== aiMessageId) return message;

                const normalizedContent = message.content.trim();
                const retryHint = 'Use **Retry from here** on your message to try again.';
                const failureContent = normalizedContent
                  ? `${normalizedContent}\n\n---\n\n⚠️ ${errorMessage}\n\n${retryHint}`
                  : `⚠️ ${errorMessage}\n\n${retryHint}`;

                return { ...message, content: failureContent };
              }),
              updatedAt: Date.now(),
            };
          }),
        );
      } finally {
        setIsLoading(false);
        setTimeoutDeadline(null);
        setTimeoutRemainingMs(null);
      }
    },
    [setConversations],
  );

  const sendMessage = useCallback(
    async (e?: FormEvent) => {
      if (e) e.preventDefault();
      if (!inputValue.trim() || isLoading || !activeConversation) return;

      const userText = inputValue.trim();
      const conversationId = activeConversation.id;
      const historyBeforeSend = toChatHistory(activeConversation.messages);

      setInputValue('');
      addLog('action', 'Sent message in conversation');

      const newUserMessage = { id: createId(), role: 'user' as const, content: userText };
      const aiMessageId = createId();

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;

          return {
            ...conversation,
            topic: conversation.topic || userText,
            title: conversation.messages.length === 0 ? toConversationTitle(userText) : conversation.title,
            messages: [
              ...conversation.messages,
              newUserMessage,
              { id: aiMessageId, role: 'ai' as const, content: '' },
            ],
            updatedAt: Date.now(),
          };
        }),
      );

      await streamReply({
        conversationId,
        aiMessageId,
        userText,
        historyBeforeSend,
        trigger: 'send',
      });
    },
    [activeConversation, inputValue, isLoading, setConversations, streamReply],
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      if (isLoading || !activeConversation) return;

      const conversationId = activeConversation.id;
      const aiMessageId = createId();
      const retryResult = resetConversationForRetry(activeConversation, messageId, aiMessageId);
      if (!retryResult) return;

      const userText = retryResult.selectedMessage.content;
      const historyBeforeSend = toChatHistory(retryResult.historyBeforeRetry);

      addLog('action', `Retried message ${messageId} in conversation`);

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          return retryResult.nextConversation;
        }),
      );

      await streamReply({
        conversationId,
        aiMessageId,
        userText,
        historyBeforeSend,
        trigger: 'retry',
      });
    },
    [activeConversation, isLoading, setConversations, streamReply],
  );

  const editMessage = useCallback(
    (messageId: string, newContent: string) => {
      if (isLoading || !activeConversation) return;

      const conversationId = activeConversation.id;

      addLog('action', `Edited message ${messageId} in conversation`);

      setConversations((prev) =>
        prev.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const nextConversation = editMessageContent(conversation, messageId, newContent);
          return nextConversation || conversation;
        }),
      );
    },
    [activeConversation, isLoading, setConversations],
  );

  const handleInputEnter = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  return {
    inputValue,
    setInputValue,
    isLoading,
    timeoutRemainingMs,
    sendMessage,
    retryMessage,
    editMessage,
    handleInputEnter,
  };
};
