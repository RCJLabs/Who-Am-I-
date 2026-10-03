<script lang="ts">
  // Principles as a diverging bar chart, most endorsed first: bars grow right (endorses) or left
  // (rejects) from a shared center line. Each row opens to the definition, consistency, any open
  // tensions, and a topic-by-topic dot strip that shows where the principle was applied unevenly.
  import { copy } from '../../copy.ts';
  import { to } from '../../routes.ts';
  import { endorsementLabel, toPercent, type RankedPrinciple } from '../../view.ts';

  let {
    rows,
    topicTitle,
    tensions,
  }: {
    rows: RankedPrinciple[];
    topicTitle: (id: string) => string;
    tensions: Map<string, { key: string; label: string }[]>;
  } = $props();

  /** Left offset and width (percent of the bar area) for a -1..1 score. */
  function bar(score: number): { left: number; width: number } {
    const width = Math.abs(score) * 50;
    return { left: score >= 0 ? 50 : 50 - width, width };
  }
</script>

<div class="chart" data-testid="principle-chart">
  <div class="legend small" aria-hidden="true">
    <span></span>
    <span class="keys">
      <span><span class="swatch reject"></span>{copy.results.rejects}</span>
      <span><span class="swatch"></span>{copy.results.endorses}</span>
    </span>
  </div>
  {#each rows as r (r.principle.id)}
    {@const b = bar(r.score)}
    {@const byTopic = Object.entries(r.result.byTopic).sort((x, y) => y[1] - x[1])}
    {@const open = tensions.get(r.principle.id) ?? []}
    <details class="prow" data-testid="principle-{r.principle.id}">
      <summary>
        <span class="label">{r.principle.label}</span>
        <span class="visually-hidden">: {endorsementLabel(r.score)}</span>
        <span class="area" aria-hidden="true">
          <span class="zero"></span>
          <span class="bar" class:neg={r.score < 0} style:left="{b.left}%" style:width="{b.width}%"></span>
        </span>
      </summary>
      <div class="more small">
        <p><strong>{endorsementLabel(r.score)}.</strong> {r.principle.definition}</p>
        {#if r.result.consistency !== null}
          <p class="muted">{copy.results.consistency(r.result.consistency)}</p>
        {/if}
        {#if open.length}
          <p class="muted">
            {copy.results.principleTensions(open.length)}:
            {#each open as t, i (t.key)}{i > 0 ? ', ' : ' '}<a href={to.tension(t.key)}>{t.label}</a>{/each}
          </p>
        {/if}
        {#if byTopic.length > 1}
          <p class="muted by-title">{copy.results.byTopic}</p>
          <ul class="by">
            {#each byTopic as [topic, v] (topic)}
              <li>
                <span class="t">{topicTitle(topic)}<span class="visually-hidden">: {endorsementLabel(v)}</span></span>
                <span class="mini" aria-hidden="true">
                  <span class="zero"></span>
                  <span class="mdot" class:neg={v < 0} style:left="{toPercent(v)}%"></span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </details>
  {/each}
</div>

<style>
  .legend,
  summary,
  .by li {
    display: grid;
    grid-template-columns: minmax(0, 44%) 1fr;
    align-items: center;
    gap: 12px;
  }
  .legend {
    color: var(--muted);
    margin-bottom: 6px;
  }
  .keys {
    display: flex;
    justify-content: space-between;
  }
  .keys > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .keys > span:first-child {
    flex-direction: row;
  }
  .swatch {
    display: inline-block;
    width: 12px;
    height: 8px;
    border-radius: 2px;
    background: var(--chart-mark);
  }
  .swatch.reject {
    background: var(--chart-reject);
  }
  .prow + .prow {
    border-top: 1px solid var(--border);
  }
  summary {
    list-style: none;
    cursor: pointer;
    padding: 9px 0;
    min-height: 44px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .label {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.25;
  }
  details[open] .label {
    color: var(--accent);
  }
  .area,
  .mini {
    position: relative;
    height: 12px;
  }
  .zero {
    position: absolute;
    left: 50%;
    top: -6px;
    bottom: -6px;
    width: 1px;
    background: var(--muted);
    opacity: 0.55;
  }
  .bar {
    position: absolute;
    top: 1px;
    height: 10px;
    background: var(--chart-mark);
    border-radius: 0 4px 4px 0;
  }
  .bar.neg {
    background: var(--chart-reject);
    border-radius: 4px 0 0 4px;
  }
  .more {
    padding: 2px 0 12px;
  }
  .more p {
    margin: 0 0 6px;
  }
  .by-title {
    margin-top: 10px !important;
  }
  .by {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .by li {
    padding: 4px 0;
  }
  .t {
    color: var(--text);
  }
  .mini {
    background: linear-gradient(var(--track), var(--track)) center / 100% 4px no-repeat;
    border-radius: 999px;
  }
  .mdot {
    position: absolute;
    top: 50%;
    width: 10px;
    height: 10px;
    margin: -5px 0 0 -5px;
    border-radius: 50%;
    background: var(--chart-mark);
    box-shadow: 0 0 0 2px var(--surface);
  }
  .mdot.neg {
    background: var(--chart-reject);
  }
</style>
