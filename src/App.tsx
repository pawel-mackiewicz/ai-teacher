import { useState, type FormEvent, type MouseEvent } from 'react';
import { AppSidebar } from './components/AppSidebar';
import { ChatPanel } from './components/ChatPanel';
import { FlashcardsPanel } from './components/FlashcardsPanel';
import { MainHeader } from './components/MainHeader';
import { SetupScreen } from './components/SetupScreen';
import { WordsPanel } from './components/WordsPanel';
import { useAiSetup } from './hooks/useAiSetup';
import { useChat } from './hooks/useChat';
import { useConversations } from './hooks/useConversations';
import { useFlashcards } from './hooks/useFlashcards';
import { useWords } from './hooks/useWords';
import './App.css';
import { getErrorMessage } from './utils/error';

function App() {
  const aiSetup = useAiSetup();
  const conversations = useConversations();
  const flashcards = useFlashcards();
  const words = useWords();
  const [activeView, setActiveView] = useState<'chat' | 'flashcards' | 'words'>('chat');
  const chat = useChat({
    activeConversation: conversations.activeConversation,
    setConversations: conversations.setConversations,
  });

  const handleSetApiKey = (e: FormEvent) => {
    e.preventDefault();
    void aiSetup.submitApiKey();
  };

  const handleCreateConversation = () => {
    if (chat.isLoading) return;

    conversations.createNewConversation();
    chat.setInputValue('');
    flashcards.setIsFlashcardsView(false);
    setActiveView('chat');
  };

  const handleDeleteConversation = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.stopPropagation();
    if (chat.isLoading) return;

    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    conversations.deleteConversation(id);
  };

  const handleSelectConversation = (conversationId: string) => {
    if (chat.isLoading) return;

    conversations.selectConversation(conversationId);
    flashcards.setIsFlashcardsView(false);
    setActiveView('chat');
  };

  const handleCreateFlashcards = async () => {
    try {
      await flashcards.generateForConversation(conversations.activeConversation);
      setActiveView('flashcards');
    } catch (error) {
      alert(getErrorMessage(error));
    }
  };

  const handleChatSubmit = (e: FormEvent) => {
    void chat.sendMessage(e);
  };

  const handleRetryMessage = (messageId: string) => {
    void chat.retryMessage(messageId);
  };

  const handleEditMessage = (messageId: string, newContent: string) => {
    chat.editMessage(messageId, newContent);
  };

  if (aiSetup.isBootstrapping) {
    return (
      <div className="app-container setup-container">
        <div className="setup-card">
          <div className="setup-header">
            <div className="setup-icon">🧠</div>
            <h1>AI Teacher</h1>
            <p>Loading your local Gemini settings...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!aiSetup.isApiKeySet) {
    return (
      <SetupScreen
        apiKey={aiSetup.apiKey}
        onApiKeyChange={aiSetup.setApiKey}
        onSubmit={handleSetApiKey}
        isModelLoading={aiSetup.isModelLoading}
        setupError={aiSetup.setupError}
      />
    );
  }

  return (
    <div className="app-container">
      <AppSidebar
        activeView={activeView}
        dueFlashcardsCount={flashcards.dueCardsCount}
        dueWordsCount={words.dueCardsCount}
        sortedConversations={conversations.sortedConversations}
        activeConversationId={conversations.activeConversationId}
        isLoading={chat.isLoading}
        onOpenFlashcards={() => {
          flashcards.setIsFlashcardsView(true);
          setActiveView('flashcards');
        }}
        onOpenWords={() => {
          flashcards.setIsFlashcardsView(false);
          setActiveView('words');
        }}
        onCreateConversation={handleCreateConversation}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <main className="app-main">
        <MainHeader
          activeView={activeView}
          hasConversationMessages={Boolean(conversations.activeConversation?.messages.length)}
          isGeneratingFlashcards={flashcards.isGeneratingFlashcards}
          onCreateFlashcards={handleCreateFlashcards}
          modelOptions={aiSetup.modelOptions}
          selectedModel={aiSetup.selectedModel}
          isLoading={chat.isLoading}
          timeoutRemainingMs={chat.timeoutRemainingMs}
          isModelLoading={aiSetup.isModelLoading}
          onModelChange={aiSetup.changeModel}
        />

        {aiSetup.modelWarning ? (
          <div className="model-warning-banner" role="status">
            {aiSetup.modelWarning}
          </div>
        ) : null}

        {activeView === 'flashcards' ? (
          <FlashcardsPanel
            key={flashcards.currentCard?.id ?? 'flashcards-empty'}
            currentCard={flashcards.currentCard}
            flashcardsCount={flashcards.flashcards.length}
            isEvaluatingAnswer={flashcards.isEvaluatingAnswer}
            evaluationError={flashcards.evaluationError}
            pendingEvaluation={flashcards.pendingEvaluation}
            requiresCorrection={flashcards.requiresCorrection}
            isCorrectionSubmitted={flashcards.isCorrectionSubmitted}
            correctedAnswer={flashcards.correctedAnswer}
            onSubmitAnswerForEvaluation={flashcards.submitAnswerForEvaluation}
            onSubmitCorrection={flashcards.submitCorrection}
            onAcceptEvaluationAndContinue={flashcards.acceptEvaluationAndContinue}
            onReviewFlashcard={flashcards.reviewFlashcard}
          />
        ) : activeView === 'words' ? (
          <WordsPanel
            settings={words.settings}
            dueCardsCount={words.dueCardsCount}
            totalCardsCount={words.totalCardsCount}
            currentCard={words.currentCard}
            currentNote={words.currentNote}
            isEnrichingWord={words.isEnrichingWord}
            isGeneratingTopicWords={words.isGeneratingTopicWords}
            manualError={words.manualError}
            topicError={words.topicError}
            manualDraft={words.manualDraft}
            topicDrafts={words.topicDrafts}
            onSetTargetLanguage={words.setTargetLanguage}
            onSetNativeLanguage={words.setNativeLanguage}
            onEnrichWord={words.enrichWord}
            onUpdateManualDraft={words.updateManualDraft}
            onSaveManualDraft={words.saveManualDraft}
            onDiscardManualDraft={words.discardManualDraft}
            onGenerateTopicDrafts={words.generateTopicDrafts}
            onUpdateTopicDraft={words.updateTopicDraft}
            onRemoveTopicDraft={words.removeTopicDraft}
            onSaveTopicDrafts={words.saveTopicDrafts}
            onClearTopicDrafts={words.clearTopicDrafts}
            onReviewWordCard={words.reviewWordCard}
          />
        ) : (
          <ChatPanel
            messages={conversations.messages}
            inputValue={chat.inputValue}
            isLoading={chat.isLoading}
            onInputChange={chat.setInputValue}
            onInputKeyDown={chat.handleInputEnter}
            onSubmit={handleChatSubmit}
            onRetryMessage={handleRetryMessage}
            onEditMessage={handleEditMessage}
          />
        )}
      </main>
    </div>
  );
}

export default App;
