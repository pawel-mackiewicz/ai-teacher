/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAT_STREAM_FIRST_TOKEN_TIMEOUT_SECONDS?: string;
  readonly VITE_CHAT_STREAM_BETWEEN_TOKENS_TIMEOUT_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
