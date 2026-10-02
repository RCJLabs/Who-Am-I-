import { mount } from 'svelte';
import bundle from 'virtual:content';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app missing');
target.replaceChildren();
mount(App, { target, props: { bundle } });
