<script lang="ts">
  // An unlabeled scale between two poles: tap a dot. Tapping answers immediately.
  let {
    itemKey,
    points,
    poles,
    selected,
    labelledby,
    onselect,
  }: {
    itemKey: string;
    points: number;
    poles: [string, string];
    selected?: number | undefined;
    labelledby: string;
    onselect: (step: number) => void;
  } = $props();

  const steps = $derived(Array.from({ length: points }, (_, i) => i + 1));
  function describe(step: number): string {
    const mid = (points + 1) / 2;
    if (step === 1) return poles[0];
    if (step === points) return poles[1];
    if (step === mid) return 'In between';
    return `Leaning ${step < mid ? poles[0] : poles[1]}`;
  }
</script>

<div class="scale" role="group" aria-labelledby={labelledby}>
  <div class="dots">
    {#each steps as step (step)}
      <button
        type="button"
        class="dot"
        class:selected={selected === step}
        aria-pressed={selected === step}
        aria-label={describe(step)}
        data-testid="scale-{itemKey}-{step}"
        onclick={() => onselect(step)}
      ></button>
    {/each}
  </div>
  <div class="poles" aria-hidden="true">
    <span>{poles[0]}</span>
    <span>{poles[1]}</span>
  </div>
</div>

<style>
  .dots {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    padding: 0 4px;
  }
  .dots::before {
    content: '';
    position: absolute;
    left: 24px;
    right: 24px;
    top: 50%;
    height: 2px;
    background: var(--track);
  }
  .dot {
    position: relative;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--border);
    background: var(--surface);
    cursor: pointer;
    transition: transform 0.1s ease, border-color 0.15s ease, background 0.15s ease;
  }
  .dot:hover {
    border-color: var(--accent);
  }
  .dot.selected {
    background: var(--accent);
    border-color: var(--accent);
    transform: scale(1.1);
  }
  .poles {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-top: 10px;
    font-size: 0.9rem;
    color: var(--muted);
  }
  .poles span:last-child {
    text-align: right;
  }
</style>
