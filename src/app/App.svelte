<script lang="ts">
  // Temporary debug page: lists compiled content. Replaced by the real app shell.
  import type { Bundle } from '../model/content.ts';

  let { bundle }: { bundle: Bundle } = $props();
  const version = __APP_VERSION__;
</script>

<main>
  <h1>Who Am I</h1>
  <p>Development build {version} · content {bundle.contentVersion}</p>
  {#each bundle.domains as domain (domain.id)}
    {@const topics = bundle.topics.filter((t) => t.domain === domain.id)}
    {#if topics.length}
      <h2>{domain.title}</h2>
      <ul>
        {#each topics as topic (topic.id)}
          <li data-testid="topic-{topic.id}">{topic.title}: {topic.items.length} items ({topic.evidence})</li>
        {/each}
      </ul>
    {/if}
  {/each}
</main>
