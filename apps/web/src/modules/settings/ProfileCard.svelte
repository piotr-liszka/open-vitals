<script lang="ts">
  /**
   * The one screen that writes the athlete's own numbers (spec 090).
   *
   * Three optional fields, and the whole point of the card is what it says about the empty ones: a
   * blank FTP is not "unknown", it is "we are estimating it from every ride separately", which is a
   * consequence the reader can only weigh if we state it. So an empty field carries BOTH what the
   * number is used for and what happens while it is missing; a set field only needs the first.
   *
   * Validation is the same pure function the handler runs (`profile.validate.ts`), so a value the
   * card accepts is a value the server accepts, and the message under the field is the reason the
   * server would have given. The server still re-validates — the card is not the only caller.
   */
  import { untrack } from 'svelte';
  import { Button, Card, Field, Input, toasts } from '$lib/ui';
  import { formatInteger, getI18n, type MessageKey } from '$lib/i18n';
  import {
    PROFILE_BOUNDS,
    PROFILE_FIELDS,
    type AthleteProfile,
    type ProfileErrorResponse,
    type ProfileField,
    type ProfileFieldError
  } from './profile.types';
  import { parseProfileInput, toProfileInput } from './profile.validate';

  interface Props {
    /** The stored profile, loaded server-side. `null` in a field means "estimated for now". */
    profile: AthleteProfile;
  }

  let { profile }: Props = $props();

  const i18n = getI18n();

  /** Per field: its label, what it changes, and what we do instead while it is blank. */
  const COPY: Readonly<Record<ProfileField, { label: MessageKey; help: MessageKey; empty: MessageKey }>> = {
    ftpWatts: { label: 'profile.ftp.label', help: 'profile.ftp.help', empty: 'profile.ftp.empty' },
    maxHrBpm: { label: 'profile.maxHr.label', help: 'profile.maxHr.help', empty: 'profile.maxHr.empty' },
    weightKg: { label: 'profile.weight.label', help: 'profile.weight.help', empty: 'profile.weight.empty' }
  };

  /**
   * The loaded profile seeds the form once and then the athlete owns it — `untrack` says that is
   * deliberate, so a re-render cannot overwrite half-typed numbers with the stored ones.
   *
   * `saved` is what is actually persisted right now; the empty-state copy follows it rather than the
   * input, so a field does not stop explaining itself the moment someone starts typing in it.
   */
  let saved = $state<AthleteProfile>(untrack(() => profile));
  let text = $state<Record<ProfileField, string>>(
    untrack(() => ({
      ftpWatts: toProfileInput(profile.ftpWatts),
      maxHrBpm: toProfileInput(profile.maxHrBpm),
      weightKg: toProfileInput(profile.weightKg)
    }))
  );
  let errors = $state<Partial<Record<ProfileField, ProfileFieldError>>>({});
  let saving = $state(false);

  /** A refusal code as a sentence, with this field's own bounds filled in. */
  function errorText(field: ProfileField, code: ProfileFieldError | undefined): string | undefined {
    if (code === undefined) return undefined;
    if (code === 'not_a_number') return i18n.t('profile.error.number');
    const bound = PROFILE_BOUNDS[field];
    return i18n.t('profile.error.range', {
      min: formatInteger(i18n.locale, bound.min),
      max: formatInteger(i18n.locale, bound.max)
    });
  }

  function helpText(field: ProfileField): string {
    const consequence = i18n.t(COPY[field].help);
    return saved[field] === null ? `${consequence} ${i18n.t(COPY[field].empty)}` : consequence;
  }

  function apply(next: AthleteProfile): void {
    saved = next;
    for (const field of PROFILE_FIELDS) text[field] = toProfileInput(next[field]);
  }

  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();

    // Check every field before sending, so all the problems surface at once.
    const found: Partial<Record<ProfileField, ProfileFieldError>> = {};
    const payload: Record<ProfileField, number | null> = { ftpWatts: null, maxHrBpm: null, weightKg: null };
    for (const field of PROFILE_FIELDS) {
      const parsed = parseProfileInput(field, text[field]);
      if (parsed.ok) payload[field] = parsed.value;
      else found[field] = parsed.error;
    }
    errors = found;
    if (Object.keys(found).length > 0) return;

    saving = true;
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = (await res.json().catch(() => null)) as AthleteProfile | ProfileErrorResponse | null;

      if (res.ok && body && !('error' in body)) {
        apply(body);
        toasts.success(i18n.t('profile.saved'));
        return;
      }
      // The server refused something the card let through: show its verdict per field.
      if (body && 'error' in body) errors = { ...body.fields };
      toasts.error(i18n.t('profile.saveFailed'));
    } catch {
      toasts.error(i18n.t('profile.networkError'));
    } finally {
      saving = false;
    }
  }
</script>

<Card title={i18n.t('profile.title')} subtitle={i18n.t('profile.subtitle')}>
  <form onsubmit={submit} novalidate>
    <p class="intro">{i18n.t('profile.intro')}</p>

    <div class="grid">
      {#each PROFILE_FIELDS as field (field)}
        <Field
          label={i18n.t(COPY[field].label)}
          help={helpText(field)}
          error={errorText(field, errors[field])}
        >
          {#snippet children(control)}
            <Input
              id={control.id}
              type="text"
              inputmode="decimal"
              autocomplete="off"
              placeholder={i18n.t('profile.placeholder')}
              aria-describedby={control.describedBy}
              invalid={control.invalid}
              bind:value={text[field]}
              disabled={saving}
            />
          {/snippet}
        </Field>
      {/each}
    </div>

    <div class="actions">
      <Button type="submit" loading={saving}>{i18n.t('common.save')}</Button>
    </div>
  </form>
</Card>

<style>
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .intro {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-5);
    align-items: start;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
