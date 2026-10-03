import type { AnswersStore } from './stores/answers.svelte.ts';
import type { ContentStore } from './stores/content.svelte.ts';
import type { SettingsStore } from './stores/settings.svelte.ts';

export interface AppContext {
  content: ContentStore;
  answers: AnswersStore;
  settings: SettingsStore;
}

let current: AppContext | null = null;

export function initApp(ctx: AppContext): void {
  current = ctx;
}

/** The app's stores. Available once main.ts has booted. */
export function app(): AppContext {
  if (!current) throw new Error('App not initialized');
  return current;
}
