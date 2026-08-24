<script lang="ts">
  import { Button, StatTile, Sparkline, ThemeToggle, LangSwitch } from '$lib/ui';

  // Illustrative fixture data for the hero preview — clearly the product's own UI, not a claim.
  const spark = [58, 61, 60, 66, 63, 69, 72];
</script>

<div class="page">
  <header class="topbar">
    <span class="brand"><span class="dot" aria-hidden="true"></span> OpenVitals</span>
    <nav class="top-nav">
      <a href="#how">Jak to działa</a>
      <a href="#self-host">Hostuj u siebie</a>
      <LangSwitch />
      <ThemeToggle />
      <Button size="sm" onclick={() => (location.href = '/auth/login')}>Zaloguj się</Button>
    </nav>
  </header>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <div class="hero-copy">
      <p class="eyebrow"><span class="eyebrow-dot" aria-hidden="true"></span>Telemetria Twojego ciała</p>
      <h1 class="headline">Dane z Twojego Garmina,<br /><span class="accent">podłączone do AI.</span></h1>
      <p class="sub">
        OpenVitals łączy Twoje konto Garmin Connect z asystentem AI przez osobisty adres MCP. Dostajesz
        pulpit, wnioski i wykresy od razu — a co się dzieje w tle, włączasz i wyłączasz w Ustawieniach.
      </p>
      <div class="cta">
        <Button size="md" onclick={() => (location.href = '/auth/login')}>Kontynuuj z Google</Button>
        <a class="ghost-cta" href="#self-host">albo hostuj u siebie →</a>
      </div>
      <p class="reassure">
        Bez hasła. Twoje dane zostają Twoje — osobno dla każdego konta, nigdy nie sprzedawane.
      </p>
    </div>

    <!-- Product preview — the real UI, as proof -->
    <div class="preview" aria-hidden="true">
      <div class="preview-head">
        <span class="preview-label">Dziś</span>
        <span class="preview-live"><span class="pulse"></span> na żywo</span>
      </div>
      <div class="preview-grid">
        <StatTile label="Kroki" value="11 039" accent="orange" delta={12} deltaSuffix="%" goodWhen="up">
          {#snippet sparkline()}<Sparkline
              values={[7100, 8200, 6400, 9100, 8800, 10200, 11039]}
              color="var(--lane-orange)"
              label="kroki"
              showArea
            />{/snippet}
        </StatTile>
        <StatTile label="HRV" value="63" unit="ms" accent="green" delta={9} deltaSuffix="%" goodWhen="up">
          {#snippet sparkline()}<Sparkline
              values={spark}
              color="var(--lane-green)"
              label="hrv"
              showArea
            />{/snippet}
        </StatTile>
        <StatTile
          label="Tętno spoczynkowe"
          value="53"
          unit="bpm"
          accent="red"
          delta={-4}
          deltaSuffix="%"
          goodWhen="down"
        />
        <StatTile label="Sen" value="7h 47m" accent="indigo" delta={6} deltaSuffix="%" goodWhen="up" />
      </div>
    </div>
  </section>

  <!-- FEATURES: the two-tier story -->
  <section class="band">
    <div class="features">
      <article>
        <h3><span class="marker" style="--m: var(--lane-orange)"></span>Twój adres MCP</h3>
        <p>
          Połącz konto Garmin i dostań osobisty adres MCP, którym czyta Twój asystent. Sen, kroki, HRV, Body
          Battery, stres, SpO₂ i więcej — zawsze Twoje. Zapis w Garminie jest tylko jeden: treningi, które sam
          ułożysz, i wyłączysz go jednym przełącznikiem.
        </p>
      </article>
      <article>
        <h3><span class="marker" style="--m: var(--lane-cyan)"></span>Pulpit i wnioski</h3>
        <p>
          Pulpit, analityka, wnioski i wykresy są na miejscu od pierwszej synchronizacji. Gotowość, anomalie i
          korelacje liczymy lokalnie — bez AI.
        </p>
      </article>
      <article>
        <h3><span class="marker" style="--m: var(--lane-green)"></span>Prywatność w standardzie</h3>
        <p>
          Każde konto jest odizolowane, a tokeny są zaszyfrowane. Każda integracja ma własne przełączniki w
          Ustawieniach — łącznie z serwerem MCP. Nic nie jest sprzedawane ani udostępniane.
        </p>
      </article>
    </div>
  </section>

  <!-- HOW IT WORKS -->
  <section id="how" class="how">
    <h2 class="section-title">Trzy kroki do Twoich danych</h2>
    <ol class="steps">
      <li>
        <span class="step-n">1</span>
        <div>
          <h4>Zaloguj się przez Google</h4>
          <p>Bez hasła. Tworzymy prywatną przestrzeń tylko dla Ciebie.</p>
        </div>
      </li>
      <li>
        <span class="step-n">2</span>
        <div>
          <h4>Połącz Garmina</h4>
          <p>
            Jednorazowe logowanie (obsługa MFA). Nie przechowujemy danych logowania — tylko zaszyfrowane
            tokeny.
          </p>
        </div>
      </li>
      <li>
        <span class="step-n">3</span>
        <div>
          <h4>Czytaj gdziekolwiek</h4>
          <p>Otwórz pulpit, albo podaj adres MCP asystentowi AI, by czytał Twoje metryki.</p>
        </div>
      </li>
    </ol>
  </section>

  <!-- SELF-HOST -->
  <section id="self-host" class="band">
    <div class="self-host">
      <div>
        <h2 class="section-title left">Wolisz uruchomić to samodzielnie?</h2>
        <p>
          OpenVitals można hostować samodzielnie. Podłącz własny Postgres i klienta Google OAuth — całość
          działa jako dwa małe kontenery na Twoim sprzęcie, a dane nigdy nie opuszczają Twojej infrastruktury.
        </p>
        <p class="fineprint">
          Do wdrożenia samodzielnego wymagany jest klient Google OAuth oraz instancja Postgres.
        </p>
      </div>
      <pre class="code" aria-label="Uruchom w Dockerze"><code
          >$ cp .env.example .env   # ustaw swoje sekrety
$ make up                # web + sidecar + postgres</code
        ></pre>
    </div>
  </section>

  <!-- FINAL CTA -->
  <section class="final">
    <h2 class="final-h">Gotowe, kiedy tylko zechcesz.</h2>
    <Button size="md" onclick={() => (location.href = '/auth/login')}>Kontynuuj z Google</Button>
  </section>

  <footer class="foot">
    <span><span class="dot" aria-hidden="true"></span> OpenVitals</span>
    <span class="foot-note">Twoje dane z Garmina — dla Ciebie i Twojego AI.</span>
  </footer>
</div>

<style>
  .page {
    min-height: 100vh;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-sans);
  }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-5) var(--space-6);
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    white-space: nowrap;
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }
  .top-nav {
    display: flex;
    align-items: center;
    gap: var(--space-5);
  }
  .top-nav a {
    color: var(--color-text-muted);
    text-decoration: none;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
  .top-nav a:hover {
    color: var(--color-text);
  }

  .hero {
    position: relative;
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-12) var(--space-6);
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    gap: var(--space-12);
    align-items: center;
  }
  /* Signature "instrument panel" backdrop: a hairline telemetry grid + a soft signal-accent glow,
     masked to fade out. Purely decorative, behind the content. */
  .hero-bg {
    position: absolute;
    inset: -12% -6% auto -6%;
    height: 135%;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(
        58% 55% at 84% 12%,
        color-mix(in srgb, var(--color-accent) 14%, transparent),
        transparent 70%
      ),
      linear-gradient(var(--color-grid, var(--color-border)) 1px, transparent 1px) 0 0 / 100% 44px,
      linear-gradient(90deg, var(--color-grid, var(--color-border)) 1px, transparent 1px) 0 0 / 44px 100%;
    -webkit-mask-image: radial-gradient(125% 78% at 50% 0%, #000 42%, transparent 100%);
    mask-image: radial-gradient(125% 78% at 50% 0%, #000 42%, transparent 100%);
    opacity: 0.55;
  }
  .hero-copy,
  .hero .preview {
    position: relative;
    z-index: 1;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0 0 var(--space-4);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-widest);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
  .eyebrow-dot {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    box-shadow: 0 0 0 4px var(--color-accent-soft);
  }
  .headline {
    margin: 0;
    font-size: clamp(2.5rem, 6vw, var(--text-5xl));
    font-weight: var(--font-black);
    line-height: var(--leading-tight);
    letter-spacing: var(--tracking-tighter);
  }
  .headline .accent {
    color: var(--color-accent);
  }
  .sub {
    margin: var(--space-5) 0 0;
    max-width: 46ch;
    font-size: var(--text-lg);
    line-height: var(--leading-normal);
    color: var(--color-text-muted);
  }
  .cta {
    display: flex;
    align-items: center;
    gap: var(--space-5);
    margin-top: var(--space-8);
  }
  .ghost-cta {
    color: var(--color-accent);
    text-decoration: none;
    font-weight: var(--font-semibold);
    font-size: var(--text-base);
  }
  .ghost-cta:hover {
    text-decoration: underline;
  }
  .reassure {
    margin: var(--space-4) 0 0;
    font-size: var(--text-sm);
    color: var(--color-text-subtle);
  }

  .preview {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: var(--space-5);
    animation: rise var(--transition-slow) both;
  }
  .preview-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-4);
  }
  .preview-label {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: var(--tracking-widest);
    color: var(--color-text-muted);
    font-weight: var(--font-semibold);
  }
  .preview-live {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-xs);
    color: var(--color-success);
    font-weight: var(--font-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-success);
    animation: pulse 2s var(--ease-in-out) infinite;
  }
  .preview-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
  }

  .band {
    border-top: 1px solid var(--color-border);
    background: var(--color-surface-2);
  }
  .features {
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-12) var(--space-6);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-8);
  }
  .features h3 {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0 0 var(--space-3);
    font-size: var(--text-lg);
    font-weight: var(--font-semibold);
    letter-spacing: var(--tracking-tight);
  }
  .marker {
    width: 12px;
    height: 12px;
    border-radius: var(--radius-sm);
    background: var(--m);
    flex-shrink: 0;
  }
  .features p {
    margin: 0;
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
  }

  .how {
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-16) var(--space-6);
  }
  .section-title {
    margin: 0 0 var(--space-8);
    font-size: var(--text-2xl);
    font-weight: var(--font-bold);
    letter-spacing: var(--tracking-tight);
    text-align: center;
  }
  .section-title.left {
    text-align: left;
    margin-bottom: var(--space-4);
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-6);
  }
  .steps li {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
  }
  .step-n {
    flex-shrink: 0;
    width: var(--space-8);
    height: var(--space-8);
    display: grid;
    place-items: center;
    border-radius: var(--radius-full);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: var(--font-black);
    font-feature-settings: var(--numeric);
  }
  .steps h4 {
    margin: 0 0 var(--space-1);
    font-size: var(--text-md);
    font-weight: var(--font-semibold);
  }
  .steps p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-normal);
  }

  .self-host {
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-16) var(--space-6);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-10);
    align-items: center;
  }
  .self-host p {
    color: var(--color-text-muted);
    line-height: var(--leading-normal);
    max-width: 48ch;
  }
  .fineprint {
    font-size: var(--text-sm);
    color: var(--color-text-subtle);
  }
  .code {
    margin: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--color-text-on-surface);
    overflow-x: auto;
    box-shadow: var(--shadow-sm);
  }

  .final {
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-16) var(--space-6);
    text-align: center;
  }
  .final-h {
    margin: 0 0 var(--space-6);
    font-size: var(--text-3xl);
    font-weight: var(--font-black);
    letter-spacing: var(--tracking-tighter);
  }

  .foot {
    border-top: 1px solid var(--color-border);
    max-width: var(--container-max);
    margin: 0 auto;
    padding: var(--space-8) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .foot > span:first-child {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--font-semibold);
    color: var(--color-text);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .preview {
      animation: none;
    }
    .pulse {
      animation: none;
    }
  }

  @media (max-width: 860px) {
    .hero,
    .self-host {
      grid-template-columns: 1fr;
      gap: var(--space-8);
    }
    .features,
    .steps {
      grid-template-columns: 1fr;
    }
    .preview {
      order: -1;
    }
  }

  /* Phones: the bar kept its four items and wrapped both section links onto two lines each
     (spec 034). Below 560px it carries identity + theme + the one action that matters; the two
     links are anchors to sections of this same page, still reachable by scrolling and from the
     hero's "albo hostuj u siebie →" CTA. */
  @media (max-width: 560px) {
    .topbar {
      padding: var(--space-4);
      gap: var(--space-3);
    }
    .top-nav {
      gap: var(--space-3);
    }
    .top-nav a {
      display: none;
    }
  }
</style>
