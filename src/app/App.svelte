<script lang="ts">
  import { app } from './context.ts';
  import { copy } from './copy.ts';
  import { router } from './router.svelte.ts';
  import NavBar from './components/NavBar.svelte';
  import Toasts from './components/Toasts.svelte';
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

  const { answers } = app();
  const route = $derived(router.route);
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

{#key route}
  {#if route.name === 'home'}
    <Home />
  {:else if route.name === 'topics'}
    <Topics />
  {:else if route.name === 'flow'}
    <Flow topicId={route.topic} edit={route.edit} />
  {:else if route.name === 'results'}
    <Results />
  {:else if route.name === 'topic-results'}
    <TopicResults topicId={route.topic} />
  {:else if route.name === 'tension'}
    <TensionView tensionKey={route.key} />
  {:else if route.name === 'settings'}
    <Settings />
  {:else if route.name === 'about'}
    <About />
  {:else if route.name === 'content'}
    <ContentPreview />
  {:else}
    <NotFound />
  {/if}
{/key}

{#if route.name !== 'flow'}
  <NavBar active={tab} />
{/if}
<Toasts />
