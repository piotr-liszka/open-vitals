<script lang="ts">
  /**
   * Base tier home (spec 014). The "standby instrument": the user connects Garmin and gets their
   * personal MCP URL — we process/display NO health data here. A confident, honest panel invites
   * the upgrade to the Advanced (data-processing) tier. Presentational; all data passed in.
   *
   * Spec 021: connection status and the MCP address now live on /settings, so this page keeps only
   * the first-run connect flow and the upgrade invitation, and points at Settings for the rest.
   */
  import { Card, Banner } from '$lib/ui';
  import SetupForm from '$modules/garmin-setup/SetupForm.svelte';
  import ConsentPanel from '$modules/consent/ConsentPanel.svelte';
  import type { HealthStatus } from '$modules/healthcheck/health.types';
  import type { ConsentFeatureView } from '$modules/consent/consent.types';

  interface Props {
    health: HealthStatus;
    /** The single Advanced gate feature, for the upgrade panel. */
    advancedFeature: ConsentFeatureView | null;
    onConnected?: () => void;
    onUpdated?: () => void;
  }
  let { health, advancedFeature, onConnected = () => {}, onUpdated = () => {} }: Props = $props();

  const ADVANTAGES = [
    'Pulpit — dzisiejsza gotowość i najważniejsze metryki na jeden rzut oka.',
    'Analityka — wielodniowe trendy i statystyki dla każdej metryki.',
    'Wnioski — gotowość, anomalie i korelacje liczone lokalnie, bez AI.',
    // Names the real range set (spec 047) — this line still advertised the old 7/30/90 windows.
    'Jeden przełącznik zakresu — 7, 14, 30 dni, rok albo cały czas, na każdej stronie.'
  ];
</script>

{#if !health.connected}
  <!-- Not connected yet: the one thing to do in Base is connect Garmin. -->
  <div class="connect">
    <Card>
      <div class="onboard">
        <div class="onboard-intro">
          <p class="eyebrow">Tryb podstawowy</p>
          <h2 class="onboard-title">Podłącz Garmina i gotowe</h2>
          <p class="onboard-lede">
            W trybie podstawowym łączysz swoje konto Garmin i dostajesz osobisty adres MCP dla asystenta AI. <strong
              >Nie przetwarzamy ani nie pokazujemy tu Twoich danych</strong
            > — pośredniczymy tylko w odczytach na Twoje żądanie.
          </p>
          <ol class="onboard-steps">
            <li>
              <span class="step-n" aria-hidden="true">1</span>
              <span>Zaloguj się danymi Garmina — użyjemy ich jednorazowo, by pobrać tokeny dostępu.</span>
            </li>
            <li>
              <span class="step-n" aria-hidden="true">2</span>
              <span>Zapisujemy wyłącznie zaszyfrowane tokeny. Twoje hasło nie jest przechowywane.</span>
            </li>
            <li>
              <span class="step-n" aria-hidden="true">3</span>
              <span>
                Twój osobisty adres MCP staje się aktywny — skopiuj go z
                <a class="link" href="/settings">Ustawień</a> do klienta AI.
              </span>
            </li>
          </ol>
        </div>
        <div class="onboard-action">
          <h3 class="onboard-action-title">Połącz konto Garmin</h3>
          <SetupForm {onConnected} />
        </div>
      </div>
    </Card>
  </div>
{:else}
  <div class="stack">
    {#if !health.reachable}
      <Banner tone="danger" title="Usługa Garmin jest chwilowo niedostępna">
        Nie udało się połączyć z usługą Garmin. Twoje dane są bezpieczne — spróbujemy ponownie automatycznie.
      </Banner>
    {/if}

    <!-- The upgrade invitation — the heart of Base. Honest about what turns on. -->
    <Card>
      <div class="advance">
        <div class="advance-copy">
          <p class="eyebrow">Tryb podstawowy jest aktywny</p>
          <h2 class="advance-title">Odblokuj tryb zaawansowany</h2>
          <p class="advance-lede">
            Na razie nic nie przetwarzamy — masz połączenie z Garminem i swój adres MCP. Włącz tryb
            zaawansowany, aby zobaczyć swoje dane w aplikacji:
          </p>
          <ul class="advance-list">
            {#each ADVANTAGES as item (item)}
              <li>
                <span class="tick" aria-hidden="true"></span>
                <span>{item}</span>
              </li>
            {/each}
          </ul>
          <p class="advance-note">
            Przetwarzanie odbywa się w Twojej sesji, dane nie są sprzedawane ani wysyłane dalej. Zgodę możesz
            wycofać w każdej chwili i wrócić do trybu podstawowego.
          </p>
        </div>
        <div class="advance-gate">
          {#if advancedFeature}
            <ConsentPanel feature={advancedFeature} onUpdated={() => onUpdated?.()} />
          {:else}
            <p class="advance-lede">Panel zgody jest chwilowo niedostępny.</p>
          {/if}
        </div>
      </div>
    </Card>

    <Card
      title="Adres MCP i połączenie"
      subtitle="Stan konta Garmin oraz Twój osobisty adres MCP znajdziesz w Ustawieniach."
    >
      <a class="link" href="/settings">Otwórz ustawienia →</a>
    </Card>
  </div>
{/if}

<style>
  .connect,
  .stack {
    margin-bottom: var(--space-8);
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }
  .eyebrow {
    margin: 0 0 var(--space-2);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* --- Connect (not yet linked) --- */
  .onboard {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: var(--space-10);
    align-items: start;
  }
  .onboard-intro {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .onboard-title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  .onboard-lede {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 48ch;
  }
  .onboard-steps {
    list-style: none;
    margin: var(--space-1) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .onboard-steps li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text-on-surface);
  }
  .step-n {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--space-6);
    height: var(--space-6);
    flex-shrink: 0;
    border-radius: var(--radius-full);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    font-feature-settings: var(--numeric);
  }
  .onboard-action {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  .onboard-action-title {
    margin: 0;
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }

  /* --- Advance (connected, invite upgrade) --- */
  .advance {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: var(--space-8);
    align-items: start;
  }
  .advance-copy {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  .advance-title {
    margin: 0;
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    color: var(--color-text);
  }
  .advance-lede {
    margin: 0;
    font-size: var(--text-md);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 52ch;
  }
  .advance-list {
    list-style: none;
    margin: var(--space-2) 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .advance-list li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    font-size: var(--text-sm);
    line-height: var(--leading-snug);
    color: var(--color-text-on-surface);
  }
  .tick {
    margin-top: 0.4em;
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 2px;
    background: var(--color-accent);
    transform: rotate(45deg);
  }
  .advance-note {
    margin: var(--space-2) 0 0;
    font-size: var(--text-xs);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
    max-width: 52ch;
  }
  .advance-gate {
    padding: var(--space-5);
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }

  .link {
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--color-accent);
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }

  @media (max-width: 720px) {
    .onboard,
    .advance {
      grid-template-columns: 1fr;
      gap: var(--space-8);
    }
  }
</style>
