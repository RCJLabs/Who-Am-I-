<script lang="ts">
  let { value, label }: { value: number; label?: string } = $props();
  const pct = $derived(Math.round(Math.max(0, Math.min(1, value)) * 100));
</script>

<div class="track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
  <div class="fill" style:width="{pct}%"></div>
</div>

<style>
  .track {
    height: 6px;
    border-radius: 999px;
    background: var(--track);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
    transition: width 0.3s ease;
  }
</style>
