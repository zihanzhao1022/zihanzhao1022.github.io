/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" only under `npm run dev:mock` (see .env.mock). */
  readonly VITE_EDITOR_MOCK?: string;
}
