## What is this?

I vibecoded this app for myself to help me learn new things—from Computer Science concepts to foreign language vocabulary. My learning process used to be scattered across multiple apps and tools, so I decided to consolidate everything into a single workspace. 

I use it daily, and I hope you find it just as useful. Enjoy!

## Core Features

The app is powered by the **Gemini API** to do the heavy lifting and uses proven learning frameworks to help you retain information:

*   **Bloom's Taxonomy Learning:** The AI structures your learning process through four key cognitive levels:
    1. *Understanding*
    2. *Applying*
    3. *Analyzing*
    4. *Evaluating*
*   **AI-Generated Flashcards:** After you learn a new topic, the AI can instantly generate flashcards based on what you just studied.
*   **Vocabulary Builder:** Perfect for learning foreign languages. Just provide a word, and the AI returns definitions, example sentences, and translations.
*   **Spaced Repetition System (SRS):** Both flashcards and vocabulary reviews are powered by the SuperMemo 2 (SM-2) algorithm, ensuring you review concepts right before you forget them.

## Getting Started

1. Clone the repo and install the dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open the app in your browser.
4. Provide your personal Gemini API key in the setup screen.
5. Start learning!

## ⚠️ Security Warning: API Key Storage

Because this is a client-side application, it stores your Gemini API key in your browser's `localStorage` for convenience. 

**This is not a secure storage method.** 
* Any malicious script running in the page context can read it.
* A malicious browser extension can read it.
* Anyone with access to your browser profile or session could potentially extract it.
  
**Best Practice:** This setup is perfectly fine for personal, local use. However, if you plan to deploy this app for production or shared environments, you must move the API key handling to a backend service. Never expose your API keys to client-side JavaScript in production.
