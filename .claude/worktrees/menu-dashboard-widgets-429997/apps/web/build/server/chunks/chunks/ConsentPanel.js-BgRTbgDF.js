import { a4 as attr_class, a5 as escape_html, ab as attr, Q as derived } from './index.js-D7taQuDv.js';
import { B as Button } from './Button.js-B1j4uOxB.js';
import './toast.js-D9a9Yw3o.js';
import { B as Badge } from './Badge.js-Bcg4u8Go.js';
import './exports.js-aFGE3YQF.js';
import './utils2.js-BQzn9ikS.js';
import './utils.js-D6eaf5bT.js';
import './root.js-DLPDgkXe.js';
import './client.js-C1MYAKQX.js';
import './client2.js-DKEBrJ7O.js';
import { r as formatInstant } from './date.js-Cf0GyZI8.js';

function ConsentPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { feature, onUpdated } = $$props;
    let busy = false;
    let error = null;
    let showTerms = false;
    async function submit(accept) {
      busy = true;
      error = null;
      try {
        const res = await fetch("/api/consent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            featureId: feature.id,
            termsVersion: feature.termsVersion,
            accept
          })
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body || !("feature" in body)) {
          error = body && "error" in body && body.error || "Coś poszło nie tak. Spróbuj ponownie.";
          return;
        }
        onUpdated?.(body.feature);
      } catch {
        error = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
      } finally {
        busy = false;
      }
    }
    const acceptedLabel = derived(() => feature.acceptedAt ? formatInstant(feature.acceptedAt, "numeric") : null);
    $$renderer2.push(`<div${attr_class("consent svelte-1d9krxm", void 0, { "granted": feature.enabled })}><div class="head svelte-1d9krxm"><div class="title-wrap"><h3 class="title svelte-1d9krxm">${escape_html(feature.title)}</h3> <p class="summary svelte-1d9krxm">${escape_html(feature.summary)}</p></div> `);
    if (feature.enabled) {
      $$renderer2.push("<!--[0-->");
      Badge($$renderer2, {
        tone: feature.requiresConsent ? "success" : "info",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->${escape_html(feature.requiresConsent ? "Zaakceptowano" : "Domyślnie włączone")}`);
        }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
      Badge($$renderer2, {
        tone: "warning",
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Wymaga zgody`);
        }
      });
    }
    $$renderer2.push(`<!--]--></div> `);
    if (feature.requiresConsent) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="terms"><button type="button" class="disclose svelte-1d9krxm"${attr("aria-expanded", showTerms)}>${escape_html("Pokaż warunki")} · v${escape_html(feature.termsVersion)}</button> `);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (error) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="error svelte-1d9krxm" role="alert">${escape_html(error)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="actions svelte-1d9krxm">`);
    if (feature.enabled && feature.requiresConsent) {
      $$renderer2.push("<!--[0-->");
      if (acceptedLabel()) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<span class="meta svelte-1d9krxm">Zaakceptowano ${escape_html(acceptedLabel())}</span>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> `);
      Button($$renderer2, {
        variant: "ghost",
        size: "sm",
        loading: busy,
        onclick: () => submit(false),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Wycofaj`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!---->`);
    } else if (!feature.enabled && feature.requiresConsent) {
      $$renderer2.push("<!--[1-->");
      Button($$renderer2, {
        variant: "primary",
        size: "sm",
        loading: busy,
        onclick: () => submit(true),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Zaakceptuj i włącz`);
        },
        $$slots: { default: true }
      });
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div>`);
  });
}

export { ConsentPanel as C };
//# sourceMappingURL=ConsentPanel.js-BgRTbgDF.js.map
