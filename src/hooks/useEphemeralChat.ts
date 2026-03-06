import { useCallback, useState } from 'react';
import { sendMessageToAI, type ChatMessage } from '../ai-service';
import { addLog } from '../logger';
import { createId } from '../utils/id';
import { getErrorMessage } from '../utils/error';

export interface UseEphemeralChatResult {
    messages: (ChatMessage & { id: string })[];
    inputValue: string;
    setInputValue: (value: string) => void;
    isLoading: boolean;
    sendMessage: (userText: string, systemPrompt?: string) => Promise<void>;
    clearChat: () => void;
}

export const useEphemeralChat = (): UseEphemeralChatResult => {
    const [messages, setMessages] = useState<(ChatMessage & { id: string })[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(async (userText: string, systemPrompt?: string) => {
        if (!userText.trim() || isLoading) return;

        setIsLoading(true);
        addLog('action', 'Sent message in ephemeral chat');

        const newUserMessage: ChatMessage & { id: string } = {
            id: createId(),
            role: 'user',
            content: userText,
        };

        const aiMessageId = createId();

        // Create a new array to represent the history *before* this turn
        // (This matches how the real chat history is evaluated by the AI)
        const historyBeforeSend = messages.map(m => ({ role: m.role, content: m.content }));

        setMessages((prev) => [
            ...prev,
            newUserMessage,
            { id: aiMessageId, role: 'ai', content: '' },
        ]);

        try {
            await sendMessageToAI(
                userText,
                historyBeforeSend,
                (chunk) => {
                    setMessages((prev) =>
                        prev.map((msg) =>
                            msg.id === aiMessageId ? { ...msg, content: chunk } : msg
                        )
                    );
                },
                {
                    systemInstruction: systemPrompt,
                    requestContext: {
                        aiMessageId,
                        trigger: 'send',
                    },
                }
            );
        } catch (error) {
            const errorMessage = getErrorMessage(error);

            setMessages((prev) =>
                prev.map((msg) => {
                    if (msg.id !== aiMessageId) return msg;

                    const normalizedContent = msg.content.trim();
                    const failureContent = normalizedContent
                        ? `${normalizedContent}\n\n---\n\n⚠️ ${errorMessage}`
                        : `⚠️ ${errorMessage}`;

                    return { ...msg, content: failureContent };
                })
            );
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, messages]);

    const clearChat = useCallback(() => {
        setMessages([]);
        setInputValue('');
        setIsLoading(false);
        addLog('action', 'Cleared ephemeral chat');
    }, []);

    return {
        messages,
        inputValue,
        setInputValue,
        isLoading,
        sendMessage,
        clearChat,
    };
};
