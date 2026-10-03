<script lang="ts">
  import { app } from './context.ts';
  import { copy } from './copy.ts';
  import { router } from './router.svelte.ts';
  import ContentGate from './components/ContentGate.svelte';
  import NavBar from './components/NavBar.svelte';
  import Toasts from './components/Toasts.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import About from './routes/About.svelte';
  import ContentPreview from './routes/ContentPreview.svelte';
  import Flow from './routes/Flow.svelte';
  import Home from './routes/Home.svelte';
  import NotFound from './routes/NotFound.svelte';
  import Results from './routes/Results.svelte';
  import Settings from './routes/Settings.svelte';
  import TensionView from './routes/TensionView.svelte';
  import TopicResults from './routes/TopicResults.svelte';
  import Topics from './routes/Topics.svelte';

  const { answers, content } = app();
  const route = $derived(router.route);
  /** What a topic's screens need loaded. An unknown topic needs nothing: it shows "not found". */
  const topicDomains = (topic: string): string[] => {
    const domain = content.topicDomain(topic);
    return domain ? [domain] : [];
  };
  const tab = $derived.by(() => {
    switch (route.name) {
      case 'home':
        return 'home' as const;
      case 'topics':
        return 'topics' as const;
      case 'results':
      case 'topic-results':
      case 'tension':
        return 'results' as const;
      case 'settings':
      case 'about':
      case 'content':
        return 'settings' as const;
      default:
        return null;
    }
  });
</script>

{#if answers.storageError}
  <div class="banner" role="alert">{copy.storageWarning}</div>
{/if}
{#if content.error}
  <div class="banner" role="alert">{copy.contentWarning}</div>
{/if}

{#key route}
  {#if route.name === 'home'}
    <Home />
  {:else if route.name === 'topics'}
    <Topics />
  {:else if route.name === 'flow'}
    <ContentGate domains={topicDomains(route.topic)}><Flow topicId={route.topic} edit={route.edit} /></ContentGate>
  {:else if route.name === 'results'}
    <Results />
  {:else if route.name === 'topic-results'}
    <ContentGate domains={topicDomains(route.topic)}><TopicResults topicId={route.topic} /></ContentGate>
  {:else if route.name === 'tension'}
    <TensionView tensionKey={route.key} />
  {:else if route.name === 'settings'}
    <Settings />
  {:else if route.name === 'about'}
    <ContentGate domains="all"><About /></ContentGate>
  {:else if route.name === 'content'}
    <ContentGate domains="all"><ContentPreview /></ContentGate>
  {:else}
    <NotFound />
  {/if}
{/key}

{#if route.name !== 'flow'}
  <NavBar active={tab} />
  <UpdateBanner />
{/if}
<Toasts />
