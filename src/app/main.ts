import './styles/app.css';
import { mount } from 'svelte';
import bundle from 'virtual:content';
import App from './App.svelte';
import { initApp } from './context.ts';
import { loadAll, type Loaded } from './storage/db.ts';
import { AnswersStore } from './stores/answers.svelte.ts';
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

initApp({
  bundle,
  answers: new AnswersStore(bundle, loaded.events, loaded.resolutions, storageOk),
  settings: new SettingsStore(loaded.settings),
});

target.replaceChildren();
mount(App, { target });
