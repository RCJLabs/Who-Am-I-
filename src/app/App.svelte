<script lang="ts">
  // Until the app shell lands, the app is a read-only preview of the content.
  import type { Bundle } from '../model/content.ts';
  import ContentPreview from './ContentPreview.svelte';

  let { bundle }: { bundle: Bundle } = $props();
</script>

<ContentPreview {bundle} />
