<script lang="ts">
  /**
   * Confirmation for a destructive action (spec 064). Built on the native `<dialog>` element, which
   * is the whole reason this is small: the platform gives focus trapping, Escape-to-close, the
   * top-layer stacking (so no `--z-*` token is involved) and the inert backdrop for free. A
   * hand-rolled modal would be several hundred lines to get the same behaviour wrong.
   *
   * Presentational and generic: it knows nothing about what is being deleted. The caller supplies the
   * wording — and should say what will be LOST, not just ask "are you sure", because the second
   * question cannot be answered without the first one's information.
   */
  import Button from './Button.svelte';

  interface Props {
    open: boolean;
    title: string;
    /** What the reader is about to lose. One or two lines. */
    body: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onconfirm: () => void;
    oncancel: () => void;
  }

  let {
    open,
    title,
    body,
    confirmLabel = 'Usuń',
    cancelLabel = 'Anuluj',
    onconfirm,
    oncancel
  }: Props = $props();

  let el: HTMLDialogElement | undefined = $state();

  /*
   * `showModal()` is a method, not an attribute, so the open prop has to be driven into the element.
   * Guarded on `el.open` because calling `showModal()` on an already-open dialog throws.
   */
  $effect(() => {
    const dialog = el;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<!--
  `cancel` fires for Escape and for the backdrop-dismiss gesture; routing it through `oncancel` keeps
  the parent's state from drifting out of sync with the element's when the platform closes it for us.
-->
<dialog bind:this={el} class="confirm" {oncancel} onclose={oncancel} aria-labelledby="confirm-title">
  <h2 class="title" id="confirm-title">{title}</h2>
  <p class="body">{body}</p>
  <div class="actions">
    <Button size="sm" variant="secondary" onclick={oncancel}>{cancelLabel}</Button>
    <!-- The destructive choice is the one that must not be clicked by muscle memory, so it is the
         one that looks different — not merely the one on the right. -->
    <Button size="sm" variant="danger" onclick={onconfirm}>{confirmLabel}</Button>
  </div>
</dialog>

<style>
  .confirm {
    width: min(28rem, calc(100vw - var(--space-8)));
    /* Restores what the UA stylesheet gives `<dialog>` and the app's `* { margin: 0 }` reset takes
       away: without it a modal dialog pins to the top-left corner instead of centring. */
    margin: auto;
    padding: var(--space-6);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-lg);
  }

  .confirm::backdrop {
    background: var(--color-overlay);
  }

  .title {
    margin: 0 0 var(--space-2);
    font-size: var(--text-md);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
  }

  .body {
    margin: 0 0 var(--space-6);
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }
</style>
