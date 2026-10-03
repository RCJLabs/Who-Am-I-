import './styles/app.css';
import { mount } from 'svelte';
import index, { loaders } from 'virtual:content';
import App from './App.svelte';
import { initApp } from './context.ts';
import { pwa } from './pwa.svelte.ts';
import { loadAll, type Loaded } from './storage/db.ts';
import { AnswersStore } from './stores/answers.svelte.ts';
import { ContentStore } from './stores/content.svelte.ts';
import { SettingsStore } from './stores/settings.svelte.ts';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');

// Some private-browsing modes leave IndexedDB hanging; don't wait on it forever.
const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('storage timeout')), 4000));
let loaded: Loaded = { events: [], resolutions: [], settings: {}, dropped: 0 };
let storageOk = true;
try {
  loaded = await Promise.race([loadAll(), timeout]);
} catch {
  storageOk = false;
}

// Only the domains already answered load now; the rest load when a screen needs them.
const content = new ContentStore(index, loaders);
await content.ensureForItems(loaded.events.map((e) => e.item));

initApp({
  content,
  answers: new AnswersStore(content, loaded.events, loaded.resolutions, storageOk),
  settings: new SettingsStore(loaded.settings),
});

target.replaceChildren();
mount(App, { target });
pwa.init();
