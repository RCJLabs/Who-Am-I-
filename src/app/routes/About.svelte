<script lang="ts">
  import privacy from '../../../docs/PRIVACY.md?raw';
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { sources } from '../view.ts';
  import Markdown from '../components/Markdown.svelte';

  const { bundle } = app();
  const cited = sources(bundle);
  const evidenceOrder = ['validated', 'adapted', 'custom', 'for-fun'] as const;
</script>

<div class="page">
  <h1>About {copy.appName}</h1>

  <section class="section">
    <h2>What this is</h2>
    <p>
      {copy.appName} asks where you stand on questions that matter, from personality to politics to taste. Then it asks
      the hard follow-ups: the circumstances that might change your answer, and the strongest case against whatever side
      you took.
    </p>
    <p>{copy.results.selfReport}</p>
  </section>

  <section class="section">
    <h2>How it works</h2>
    <ul>
      <li><strong>Your view, then the circumstances.</strong> Most topics start with your overall position, then test it against specific cases.</li>
      <li><strong>Challenges.</strong> Thought experiments and arguments aimed at the side you chose, written as strongly as possible. You can hold your ground, name a difference, or reconsider. Whoever you are, you'll be challenged.</li>
      <li><strong>Re-asks.</strong> After the challenges, you're asked where you land now. Changes are recorded as your own reconsideration, not as anyone winning.</li>
      <li><strong>Tensions.</strong> Some statements are matched across topics, such as who should decide what happens to your body. If you answer them very differently, the app points it out and asks what explains the difference. Often there's a good reason.</li>
      <li><strong>Skip anything.</strong> Every question can be skipped. Topics you say matter little to you get fewer deep-dive questions.</li>
    </ul>
  </section>

  <section class="section">
    <h2>How scores work</h2>
    <p>
      Each answer moves you along one or more spectrums. Your score is the weighted average of everything that bears on it.
      Confidence grows with the amount of evidence, and a spectrum shows "not enough data" until you've answered enough.
      Scores are raw positions on these scales. There's no population data, so they don't say how you compare to other people.
    </p>
    <h3>Evidence labels</h3>
    <ul>
      {#each evidenceOrder as e (e)}
        <li><strong>{copy.evidence[e].label}:</strong> {copy.evidence[e].explain}</li>
      {/each}
    </ul>
  </section>

  <section class="section">
    <h2>Sources</h2>
    <ul class="small">
      {#each cited as s (s.source)}<li>{s.source} <span class="muted">({s.topic})</span></li>{/each}
    </ul>
  </section>

  <section class="section">
    <Markdown source={privacy} />
  </section>
</div>
