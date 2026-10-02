<script lang="ts">
  import type { Evidence } from '../../model/content.ts';
  import { copy } from '../copy.ts';

  let { evidence }: { evidence: Evidence } = $props();
  const info = $derived(copy.evidence[evidence]);
</script>

<span class="chip" class:accent={evidence === 'validated'} title={info.explain}>{info.label}</span>
