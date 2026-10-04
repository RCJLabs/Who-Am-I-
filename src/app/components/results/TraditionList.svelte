<script lang="ts">
  // The political traditions nearest the user's answers, in the Politics section. Reference
  // points, never a label: each row says how close it is in words, where the answers differ, and
  // what the tradition stands for in its adherents' terms.
  import type { TraditionsView } from '../../analysis/compose.ts';
  import { copy } from '../../copy.ts';
  import type { AnalysisState } from '../../stores/content.svelte.ts';

  let { view, state }: { view: TraditionsView | null; state: AnalysisState } = $props();
  const T = copy.analysis.traditions;
</script>

<div class="card traditions" data-testid="traditions" data-status={view?.status ?? state}>
  <h3>{T.title}</h3>
  <p class="small muted note">{T.note}</p>
  {#if state === 'failed'}
    <div class="failed" role="alert">
      <p class="small">{T.failed}</p>
      <button type="button" class="btn ghost" onclick={() => location.reload()}>{T.reload}</button>
    </div>
  {:else if !view}
    <p class="small muted" aria-live="polite">{T.loading}</p>
  {:else if view.status === 'insufficient'}
    <p class="small">{view.lead}</p>
  {:else}
    {#if view.basis}<p class="small muted">{view.basis}</p>{/if}
    <ol>
      {#each view.rows as r (r.id)}
        <li data-testid="tradition-{r.id}">
          <details>
            <summary>
              <span class="head">
                <span class="name">{r.name}</span>
                <span class="band" class:near={r.closeness === 'very-close' || r.closeness === 'close'}>{r.band}</span>
                <span class="chev" aria-hidden="true"></span>
              </span>
              {#each r.differences as d (d)}<span class="diff small">{d}</span>{/each}
            </summary>
            <div class="more small">
              <p>{r.summary}</p>
              {#if r.split}<p><strong>{T.splitFrom(r.split.from)}:</strong> {r.split.text}</p>{/if}
              {#if r.divided}<p class="muted">{r.divided}</p>{/if}
            </div>
          </details>
        </li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  h3 {
    margin: 0 0 2px;
  }
  .note {
    margin: 0 0 6px;
  }
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  summary {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 0;
    min-height: 48px;
    list-style: none;
    cursor: pointer;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .name {
    flex: 1;
    min-width: 0;
    font-weight: 650;
  }
  .band {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--muted);
    white-space: nowrap;
  }
  .band.near {
    color: var(--accent);
  }
  .chev {
    width: 8px;
    height: 8px;
    margin-left: 2px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: translateY(-2px) rotate(45deg);
    transition: transform 0.15s;
    flex: none;
  }
  details[open] .chev {
    transform: translateY(1px) rotate(-135deg);
  }
  .diff {
    color: var(--muted);
  }
  .more {
    padding: 0 0 12px;
  }
  .more p {
    margin: 0 0 6px;
  }
  .failed {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .failed p {
    margin: 0;
  }
</style>
