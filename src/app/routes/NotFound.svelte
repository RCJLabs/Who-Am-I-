<script lang="ts">
  import { to } from '../routes.ts';

  let { message = "That page doesn't exist." }: { message?: string } = $props();
</script>

<div class="page center">
  <h1>Not found</h1>
  <p class="muted">{message}</p>
  <a class="btn primary" href={to.home()}>Home</a>
</div>
