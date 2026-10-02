<script lang="ts">
  import { copy } from '../copy.ts';
  import { to } from '../routes.ts';
  import Icon from './Icon.svelte';

  let { active }: { active: 'home' | 'topics' | 'results' | 'settings' | null } = $props();

  const tabs = [
    { id: 'home', href: to.home(), label: copy.nav.home, icon: 'home' },
    { id: 'topics', href: to.topics(), label: copy.nav.topics, icon: 'list' },
    { id: 'results', href: to.results(), label: copy.nav.results, icon: 'chart' },
    { id: 'settings', href: to.settings(), label: copy.nav.settings, icon: 'sliders' },
  ] as const;
</script>

<nav aria-label="Main">
  {#each tabs as tab (tab.id)}
    <a href={tab.href} aria-current={active === tab.id ? 'page' : undefined} data-testid="nav-{tab.id}">
      <Icon name={tab.icon} />
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  nav {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    gap: 4px;
    height: calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: color-mix(in srgb, var(--surface) 92%, transparent);
    backdrop-filter: blur(12px);
    border-top: 1px solid var(--border);
  }
  a {
    flex: 0 1 140px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 600;
  }
  a[aria-current='page'] {
    color: var(--accent);
  }
</style>
