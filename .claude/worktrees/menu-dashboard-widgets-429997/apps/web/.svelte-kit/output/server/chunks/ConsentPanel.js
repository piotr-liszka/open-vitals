import { b as attr_class, e as escape_html, c as attr, g as derived } from "./index.js";
import { B as Button } from "./Button.js";
/* empty css                                   */
import "./toast.js";
import { B as Badge } from "./Badge.js";
/* empty css                                               */
/* empty css                                       */
/* empty css                                          */
/* empty css                                       */
/* empty css                                         */
/* empty css                                         */
/* empty css                                         */
/* empty css                                    */
/* empty css                                         */
import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils2.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./client.js";
import "./client2.js";
import { h as formatInstant } from "./date.js";
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
export {
  ConsentPanel as C
};
