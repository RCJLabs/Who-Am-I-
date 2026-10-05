<script lang="ts">
  // Share a card: each card is an image drawn on this device (src/app/share/) from answers that
  // could be shared, never sensitive ones. Swipe between the cards (or use the arrows and dots),
  // pick light or dark, then share one through the system's share sheet or save it. Nothing leaves
  // the device otherwise. See docs/ANALYSIS.md, "Share cards".
  import { untrack } from 'svelte';
  import { matchTraditions, shareableAnswers } from '../../engine/analysis/traditions.ts';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { router } from '../router.svelte.ts';
  import { to, type CardId } from '../routes.ts';
  import { shareCards } from '../share/cards.ts';
  import type { CardTheme } from '../share/layout.ts';
  import { cardImage, HEIGHT, WIDTH } from '../share/render.ts';
  import { canShareImages, fileName, saveImage, shareImage } from '../share/send.ts';
  import { toasts } from '../stores/toasts.svelte.ts';
  import { endorsementLabel, rankedPrinciples } from '../view.ts';
  import Icon from '../components/Icon.svelte';

  let { card: wanted = null }: { card?: CardId | null } = $props();

  const S = copy.share;
  const { content, answers } = app();
  const axes = Object.values(content.bundle.axes);
  const principles = Object.values(content.bundle.principles);
  const hasAny = $derived(answers.events.length > 0);

  // The politics card names the closest political tradition, which needs the analysis pack.
  $effect(() => {
    if (hasAny) untrack(() => void content.ensureAnalysis());
  });
  const settled = $derived(content.analysisState === 'ready' || content.analysisState === 'failed');
  const pack = $derived(content.analysisPack);
  const pub = $derived(answers.publicProfile);
  const cards = $derived(
    shareCards({
      axes,
      principles,
      profile: pub,
      traditions: pack
        ? { facts: matchTraditions(content.bundle, pub, pack, shareableAnswers(answers.state)), name: (id) => pack.traditions.find((t) => t.id === id)?.name ?? id }
        : null,
    }),
  );
  // Principles are the one part of a card that answers on sensitive topics can move.
  const principlesDiffer = $derived.by(() => {
    const read = (scores: typeof pub.principles) => rankedPrinciples(principles, scores).map((r) => `${r.principle.id} ${endorsementLabel(r.score)}`).join();
    return read(pub.principles) !== read(answers.profile.principles);
  });

  const prefersDark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  let theme = $state<CardTheme>(prefersDark ? 'dark' : 'light');
  const THEMES = [
    ['light', S.light],
    ['dark', S.dark],
  ] as const;
  const canShare = canShareImages();

  // Each card's image, drawn again when the cards or the theme change; null if it couldn't be drawn.
  let images = $state.raw<Partial<Record<CardId, { url: string; blob: Blob } | null>>>({});
  let round = 0;
  $effect(() => {
    // Wait for the traditions, so the politics card is drawn once.
    if (!settled) return;
    const list = cards;
    const t = theme;
    const first = untrack(() => index);
    const mine = ++round;
    void (async () => {
      // The card on screen first.
      for (const c of [...list.slice(first), ...list.slice(0, first)]) {
        let next: { url: string; blob: Blob } | null = null;
        try {
          const blob = await cardImage(c, t);
          next = { blob, url: URL.createObjectURL(blob) };
        } catch {
          next = null;
        }
        if (mine !== round) {
          if (next) URL.revokeObjectURL(next.url);
          return;
        }
        const old = images[c.id];
        images = { ...images, [c.id]: next };
        if (old) URL.revokeObjectURL(old.url);
      }
    })();
  });
  $effect(() => () => {
    round++;
    for (const img of Object.values(untrack(() => images))) if (img) URL.revokeObjectURL(img.url);
  });

  // The carousel: the card nearest the middle is the current one.
  let index = $state(0);
  let track = $state<HTMLElement | null>(null);
  const current = $derived(cards[Math.min(index, cards.length - 1)] ?? null);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const slides = () => [...(track?.querySelectorAll<HTMLElement>('.slide') ?? [])];

  function onscroll(): void {
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    const off = slides().map((el) => Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid));
    index = off.indexOf(Math.min(...off));
  }

  function go(k: number, smooth = !reduced): void {
    const el = slides()[k];
    if (!track || !el) return;
    index = k;
    track.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  // Open at the card asked for (from an area's page).
  let opened = false;
  $effect(() => {
    if (opened || !track || !cards.length) return;
    opened = true;
    const k = wanted ? cards.findIndex((c) => c.id === wanted) : -1;
    if (k > 0) go(k, false);
  });

  let busy = $state(false);
  async function share(): Promise<void> {
    const img = current && images[current.id];
    if (!img || busy) return;
    busy = true;
    if ((await shareImage(img.blob, fileName(current.id))) === 'failed') toasts.push(S.shareFailed);
    busy = false;
  }
  function save(): void {
    const img = current && images[current.id];
    if (!img) return;
    saveImage(img.blob, fileName(current.id));
    toasts.push(S.saved);
  }

  /** The back link returns through history when it can, so Back doesn't lead here again. */
  function back(e: MouseEvent): void {
    const from = router.previous?.name;
    if (from !== 'results' && from !== 'area') return;
    e.preventDefault();
    history.back();
  }

  let heading = $state<HTMLElement | null>(null);
  $effect(() => heading?.focus({ preventScroll: true }));
</script>

<div class="page">
  <a class="back" href={to.results()} data-testid="share-back" onclick={back}><Icon name="left" size={20} />{copy.analysis.overview.back}</a>
  <h1 tabindex="-1" bind:this={heading}>{S.title}</h1>

  {#if !cards.length}
    <div class="card center">
      <p>{S.nothing}</p>
      <a class="btn primary" href={to.topics()}>{S.nothingCta}</a>
    </div>
  {:else}
    <p class="muted intro">{S.intro}</p>

    <div class="track" bind:this={track} {onscroll} role="region" aria-roledescription="carousel" aria-label={S.cards} data-testid="share-cards">
      {#each cards as c, k (c.id)}
        {@const img = images[c.id]}
        <figure
          class="slide"
          role="group"
          aria-roledescription="slide"
          aria-label={S.position(k + 1, cards.length, c.name)}
          aria-current={k === index ? 'true' : undefined}
          data-testid="share-card-{c.id}"
        >
          {#if img}
            <img src={img.url} alt={c.alt} width={WIDTH} height={HEIGHT} data-testid="share-image-{c.id}" />
          {:else}
            <div class="placeholder small muted" role="img" aria-label={c.alt}>{img === null ? S.failed : S.making}</div>
          {/if}
        </figure>
      {/each}
    </div>

    <div class="controls">
      <button type="button" class="round" aria-label={S.prev} disabled={index === 0} onclick={() => go(index - 1)} data-testid="share-prev">
        <Icon name="left" size={20} />
      </button>
      <div class="dots">
        {#each cards as c, k (c.id)}
          <button type="button" class="dot" aria-label={c.name} aria-current={k === index ? 'true' : undefined} onclick={() => go(k)} data-testid="share-dot-{c.id}">
            <span></span>
          </button>
        {/each}
      </div>
      <button type="button" class="round" aria-label={S.next} disabled={index === cards.length - 1} onclick={() => go(index + 1)} data-testid="share-next">
        <Icon name="right" size={20} />
      </button>
    </div>
    <p class="visually-hidden" role="status">{current ? S.position(index + 1, cards.length, current.name) : ''}</p>

    <fieldset class="theme">
      <legend class="small muted">{S.theme}</legend>
      {#each THEMES as [value, label] (value)}
        <label class="seg">
          <input type="radio" name="share-theme" {value} bind:group={theme} data-testid="share-theme-{value}" />
          <span>{label}</span>
        </label>
      {/each}
    </fieldset>

    <div class="actions">
      {#if canShare}
        <button type="button" class="btn primary" disabled={!current || !images[current.id] || busy} onclick={share} data-testid="share-share">
          <Icon name="share" size={20} />{S.share}
        </button>
      {/if}
      <button type="button" class="btn" class:primary={!canShare} disabled={!current || !images[current.id]} onclick={save} data-testid="share-save">
        <Icon name="download" size={20} />{S.save}
      </button>
    </div>
    {#if current?.id === 'principles' && principlesDiffer}<p class="small muted note" data-testid="share-differs">{S.differs}</p>{/if}
    <p class="small muted note">{S.leaves}</p>
  {/if}
</div>

<style>
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    margin: -8px 0 4px -6px;
    padding-right: 10px;
    font-weight: 600;
    text-decoration: none;
  }
  h1 {
    font-size: 2rem;
    letter-spacing: -0.015em;
  }
  h1:focus {
    outline: none;
  }
  .intro {
    margin-bottom: 16px;
  }
  /* One card at a time, centred, with its neighbours peeking in at the sides. */
  .track {
    --w: min(78%, 400px);
    position: relative;
    display: flex;
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    padding: 4px 0 8px;
  }
  .track::-webkit-scrollbar {
    display: none;
  }
  .track::before,
  .track::after {
    content: '';
    flex: 0 0 calc((100% - var(--w)) / 2 - 12px);
  }
  .slide {
    flex: 0 0 var(--w);
    margin: 0;
    scroll-snap-align: center;
  }
  .slide img,
  .placeholder {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 4 / 5;
    border-radius: 18px;
    border: 1px solid var(--border);
    box-shadow: var(--shadow);
  }
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    text-align: center;
    background: var(--surface-2);
  }
  .controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    max-width: 400px;
    margin: 8px auto 0;
  }
  .round {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .round:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .dots {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }
  .dot {
    width: 30px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .dot span {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--border);
    transition: width 0.15s;
  }
  .dot[aria-current='true'] span {
    width: 22px;
    background: var(--accent);
  }
  .theme {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 16px auto 0;
    padding: 0;
    border: 0;
    max-width: 400px;
  }
  .theme legend {
    float: left;
    margin-right: 6px;
  }
  .seg {
    position: relative;
  }
  .seg input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }
  .seg span {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0 18px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--surface);
    font-weight: 600;
  }
  .seg input:checked + span {
    border-color: var(--accent);
    background: var(--accent-soft);
    color: var(--text);
  }
  .seg input:focus-visible + span {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    max-width: 400px;
    margin: 16px auto 0;
  }
  .note {
    max-width: 400px;
    margin: 12px auto 0;
  }
</style>
