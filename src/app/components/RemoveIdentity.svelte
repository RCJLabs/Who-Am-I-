<script lang="ts">
  import { app } from '../context.ts';
  import { copy } from '../copy.ts';
  import { toasts } from '../stores/toasts.svelte.ts';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import Icon from './Icon.svelte';

  const { answers } = app();
  let open = $state(false);

  async function remove(): Promise<void> {
    open = false;
    const ok = await answers.removeIdentity();
    toasts.push(ok ? copy.settings.identityRemoved : copy.settings.identityRemoveFailed, ok ? undefined : 8000);
  }
</script>

<button class="btn danger" onclick={() => (open = true)} data-testid="identity-remove">
  <Icon name="trash" size={18} />
  {copy.settings.identityRemove}
</button>

<ConfirmDialog
  bind:open
  title={copy.settings.identityRemove}
  actions={[
    { label: copy.settings.identityRemove, kind: 'danger', onclick: remove, testid: 'identity-remove-confirm' },
    { label: copy.settings.cancel, kind: 'ghost', onclick: () => (open = false) },
  ]}
>
  <p>{copy.settings.identityRemoveConfirm}</p>
</ConfirmDialog>
