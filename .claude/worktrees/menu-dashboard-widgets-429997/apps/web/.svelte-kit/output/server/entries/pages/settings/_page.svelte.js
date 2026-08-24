import { b as attr_class, e as escape_html, g as derived, c as attr, h as head, a as ensure_array_like } from "../../../chunks/index.js";
import { i as invalidateAll } from "../../../chunks/client.js";
import { t as toasts } from "../../../chunks/toast.js";
import { C as Card } from "../../../chunks/Card.js";
/* empty css                                                  */
/* empty css                                                             */
/* empty css                                                     */
/* empty css                                                        */
/* empty css                                                     */
/* empty css                                                 */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                       */
/* empty css                                                  */
/* empty css                                                       */
import "../../../chunks/client2.js";
import { A as AppShell } from "../../../chunks/AppShell.js";
import { S as SyncFooter } from "../../../chunks/SyncFooter.js";
import { C as ConsentPanel } from "../../../chunks/ConsentPanel.js";
import { B as Button, S as Spinner } from "../../../chunks/Button.js";
import { B as Badge } from "../../../chunks/Badge.js";
import { T as Toggle } from "../../../chunks/Toggle.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils2.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import { h as formatInstant } from "../../../chunks/date.js";
import { S as SetupForm } from "../../../chunks/SetupForm.js";
function AdvancedModeToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { feature, onUpdated } = $$props;
    let pending = null;
    let busy = false;
    let error = null;
    function onToggle(next) {
      error = null;
      pending = next ? "enabling" : "disabling";
    }
    function cancel() {
      pending = null;
      error = null;
    }
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
        pending = null;
        onUpdated?.(body.feature);
      } catch {
        error = "Nie udało się połączyć z serwerem. Spróbuj ponownie.";
      } finally {
        busy = false;
      }
    }
    const acceptedLabel = derived(() => feature.acceptedAt ? formatInstant(feature.acceptedAt, "numeric") : null);
    $$renderer2.push(`<div${attr_class("adv svelte-xcilgj", void 0, { "on": feature.enabled })}><div class="head svelte-xcilgj"><div class="copy svelte-xcilgj"><div class="title-row svelte-xcilgj"><h3 class="title svelte-xcilgj">${escape_html(feature.title)}</h3> `);
    Badge($$renderer2, {
      tone: feature.enabled ? "success" : "neutral",
      children: ($$renderer3) => {
        $$renderer3.push(`<!---->${escape_html(feature.enabled ? "Włączony" : "Wyłączony")}`);
      }
    });
    $$renderer2.push(`<!----></div> <p class="summary svelte-xcilgj">${escape_html(feature.summary)}</p> `);
    if (feature.enabled && acceptedLabel()) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="meta svelte-xcilgj">Zaakceptowano ${escape_html(acceptedLabel())} · warunki v${escape_html(feature.termsVersion)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    Toggle($$renderer2, {
      checked: feature.enabled,
      loading: busy,
      label: "Przełącz tryb zaawansowany",
      onchange: onToggle
    });
    $$renderer2.push(`<!----></div> `);
    if (pending === "enabling") {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="panel svelte-xcilgj"><p class="panel-title svelte-xcilgj">Włącz tryb zaawansowany</p> <p class="terms-text svelte-xcilgj">${escape_html(feature.termsText)}</p> `);
      if (error) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="error svelte-xcilgj" role="alert">${escape_html(error)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="actions svelte-xcilgj">`);
      Button($$renderer2, {
        variant: "ghost",
        size: "sm",
        onclick: cancel,
        disabled: busy,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Anuluj`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
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
      $$renderer2.push(`<!----></div></div>`);
    } else if (pending === "disabling") {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div class="panel svelte-xcilgj"><p class="panel-title svelte-xcilgj">Wyłączyć tryb zaawansowany?</p> <p class="panel-body svelte-xcilgj">Wrócisz do trybu podstawowego — zostaje samo połączenie z Garminem i Twój adres MCP. Pulpit, analityka
        i wnioski zostaną ukryte, a pobieranie zakresów danych zatrzymane. Możesz włączyć tryb zaawansowany
        ponownie w każdej chwili.</p> `);
      if (error) {
        $$renderer2.push("<!--[0-->");
        $$renderer2.push(`<p class="error svelte-xcilgj" role="alert">${escape_html(error)}</p>`);
      } else {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <div class="actions svelte-xcilgj">`);
      Button($$renderer2, {
        variant: "ghost",
        size: "sm",
        onclick: cancel,
        disabled: busy,
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Anuluj`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----> `);
      Button($$renderer2, {
        variant: "danger",
        size: "sm",
        loading: busy,
        onclick: () => submit(false),
        children: ($$renderer3) => {
          $$renderer3.push(`<!---->Wyłącz tryb zaawansowany`);
        },
        $$slots: { default: true }
      });
      $$renderer2.push(`<!----></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function ConnectionCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      status,
      onRefresh,
      refreshing = false,
      onDisconnect,
      disconnecting = false,
      connect
    } = $$props;
    let confirming = false;
    const tone = derived(() => !status.reachable ? "warning" : status.connected ? "success" : "danger");
    const label = derived(() => !status.reachable ? "Niedostępny" : status.connected ? "Połączono" : "Nie połączono");
    {
      let actions = function($$renderer3) {
        if (onRefresh) {
          $$renderer3.push("<!--[0-->");
          Button($$renderer3, {
            size: "sm",
            variant: "ghost",
            loading: refreshing,
            onclick: onRefresh,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Odśwież`);
            },
            $$slots: { default: true }
          });
        } else {
          $$renderer3.push("<!--[-1-->");
        }
        $$renderer3.push(`<!--]-->`);
      };
      Card($$renderer2, {
        title: "Połączenie z Garmin",
        subtitle: "Nie przechowujemy Twojego loginu — tylko zaszyfrowane tokeny, które zwraca Garmin.",
        actions,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="body svelte-rqfqvc"><div class="status svelte-rqfqvc"><span${attr_class(`beacon ${tone()}`, "svelte-rqfqvc")} aria-hidden="true"></span> `);
          Badge($$renderer3, {
            tone: tone(),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(label())}`);
            }
          });
          $$renderer3.push(`<!----> `);
          if (status.displayName) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<span class="who svelte-rqfqvc">${escape_html(status.displayName)}</span>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div> <dl class="meta svelte-rqfqvc">`);
          if (status.expiresAt) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="svelte-rqfqvc"><dt class="svelte-rqfqvc">Sesja ważna do</dt> <dd class="svelte-rqfqvc">${escape_html(new Date(status.expiresAt).toLocaleString("pl-PL"))}</dd></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (!status.reachable) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="svelte-rqfqvc"><dt class="svelte-rqfqvc">Szczegóły</dt> <dd class="svelte-rqfqvc">Nie udało się połączyć z usługą Garmin. Spróbujemy ponownie automatycznie.</dd></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></dl> `);
          if (status.connected) {
            $$renderer3.push("<!--[0-->");
            if (onDisconnect) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="row svelte-rqfqvc">`);
              if (confirming) {
                $$renderer3.push("<!--[0-->");
                $$renderer3.push(`<span class="confirm-q svelte-rqfqvc">Rozłączyć i usunąć zapisane tokeny?</span> <div class="confirm-actions svelte-rqfqvc">`);
                Button($$renderer3, {
                  size: "sm",
                  variant: "ghost",
                  onclick: () => confirming = false,
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->Anuluj`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push(`<!----> `);
                Button($$renderer3, {
                  size: "sm",
                  variant: "danger",
                  loading: disconnecting,
                  onclick: onDisconnect,
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->Rozłącz`);
                  },
                  $$slots: { default: true }
                });
                $$renderer3.push(`<!----></div>`);
              } else {
                $$renderer3.push("<!--[-1-->");
                Button($$renderer3, {
                  size: "sm",
                  variant: "secondary",
                  onclick: () => confirming = true,
                  children: ($$renderer4) => {
                    $$renderer4.push(`<!---->Rozłącz Garmina`);
                  },
                  $$slots: { default: true }
                });
              }
              $$renderer3.push(`<!--]--></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          } else if (connect) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<div class="connect svelte-rqfqvc">`);
            connect($$renderer3);
            $$renderer3.push(`<!----></div>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        }
      });
    }
  });
}
function McpUrlCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { url, connected = false } = $$props;
    let copied = false;
    let rotating = false;
    let rotatedUrl = null;
    const displayUrl = derived(() => rotatedUrl ?? url);
    async function copy() {
      try {
        await navigator.clipboard.writeText(displayUrl());
        copied = true;
        toasts.success("Skopiowano adres MCP do schowka.");
        setTimeout(() => copied = false, 1500);
      } catch {
        toasts.error("Nie udało się skopiować — zaznacz i skopiuj ręcznie.");
      }
    }
    async function rotate() {
      rotating = true;
      try {
        const res = await fetch("/api/settings/mcp-token/rotate", { method: "POST" });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.url) {
          rotatedUrl = body.url;
          toasts.success("Token wymieniony — stary adres już nie działa.");
        } else {
          toasts.error("Nie udało się wymienić tokenu. Spróbuj ponownie.");
        }
      } catch {
        toasts.error("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      } finally {
        rotating = false;
      }
    }
    {
      let actions = function($$renderer3) {
        Badge($$renderer3, {
          tone: connected ? "success" : "neutral",
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(connected ? "Gotowe" : "Najpierw połącz Garmina")}`);
          }
        });
      };
      Card($$renderer2, {
        title: "Twój adres MCP",
        subtitle: "Dodaj go jako konektor w Claude lub ChatGPT",
        actions,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="body svelte-47zroz"><div class="url svelte-47zroz" role="group" aria-label="Adres MCP"><code class="svelte-47zroz">${escape_html(displayUrl())}</code> `);
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            onclick: copy,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->${escape_html(copied ? "Skopiowano" : "Kopiuj")}`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----> `);
          Button($$renderer3, {
            size: "sm",
            variant: "ghost",
            loading: rotating,
            onclick: rotate,
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Wymień`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----></div> <p class="hint svelte-47zroz">Ten adres jest przypisany tylko do Twojego konta i zawiera sekretny token — traktuj go jak hasło. Każdy,
      kto go ma, może przez tę usługę czytać Twoje dane z Garmina. Użyj przycisku <strong>Wymień</strong>, aby wygenerować nowy token; poprzedni adres przestaje działać natychmiast.</p></div>`);
        }
      });
    }
  });
}
function IntegrationsPanel($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { status } = $$props;
    let busy = null;
    let message = null;
    async function sync(provider) {
      busy = `${provider}:sync`;
      message = null;
      try {
        const res = await fetch(`/api/integrations/${provider}/sync`, { method: "POST" });
        const data = await res.json();
        if (provider === "withings") message = `Zaimportowano ${data.imported ?? 0} pomiarów wagi.`;
        else message = `Przeskanowano ${data.scanned ?? 0}, powiązano ${data.matched ?? 0} aktywności.`;
        await invalidateAll();
      } catch {
        message = "Synchronizacja nie powiodła się.";
      } finally {
        busy = null;
      }
    }
    async function disconnect(provider) {
      busy = `${provider}:disc`;
      try {
        await fetch(`/api/integrations/${provider}/disconnect`, { method: "POST" });
        await invalidateAll();
      } finally {
        busy = null;
      }
    }
    $$renderer2.push(`<div class="stack svelte-1qne1vi">`);
    if (message) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<p class="msg svelte-1qne1vi">${escape_html(message)}</p>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    Card($$renderer2, {
      title: "Strava",
      subtitle: "Powiąż swoje aktywności Garmin z ich odpowiednikami w Strava.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="row svelte-1qne1vi"><div class="status svelte-1qne1vi">`);
        if (status.strava.connected) {
          $$renderer3.push("<!--[0-->");
          Badge($$renderer3, {
            tone: "success",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Połączono`);
            }
          });
          $$renderer3.push(`<!----> <span class="detail svelte-1qne1vi">Powiązane aktywności: ${escape_html(status.strava.linkedCount)}</span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          Badge($$renderer3, {
            tone: "neutral",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Nie połączono`);
            }
          });
        }
        $$renderer3.push(`<!--]--></div> <div class="actions svelte-1qne1vi">`);
        if (status.strava.connected) {
          $$renderer3.push("<!--[0-->");
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            loading: busy === "strava:sync",
            onclick: () => sync("strava"),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Powiąż aktywności`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----> `);
          Button($$renderer3, {
            size: "sm",
            variant: "ghost",
            loading: busy === "strava:disc",
            onclick: () => disconnect("strava"),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Rozłącz`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!---->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<a class="connect svelte-1qne1vi" href="/api/integrations/strava/connect">Połącz ze Strava</a>`);
        }
        $$renderer3.push(`<!--]--></div></div>`);
      }
    });
    $$renderer2.push(`<!----> `);
    Card($$renderer2, {
      title: "Withings",
      subtitle: "Importuj pomiary wagi z konta Withings do lokalnego magazynu.",
      children: ($$renderer3) => {
        $$renderer3.push(`<div class="row svelte-1qne1vi"><div class="status svelte-1qne1vi">`);
        if (status.withings.connected) {
          $$renderer3.push("<!--[0-->");
          Badge($$renderer3, {
            tone: "success",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Połączono`);
            }
          });
          $$renderer3.push(`<!----> <span class="detail svelte-1qne1vi">Pomiary wagi: ${escape_html(status.withings.weightCount)} `);
          if (status.withings.firstDay) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`· ${escape_html(status.withings.firstDay)}–${escape_html(status.withings.lastDay)}`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></span>`);
        } else {
          $$renderer3.push("<!--[-1-->");
          Badge($$renderer3, {
            tone: "neutral",
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Nie połączono`);
            }
          });
        }
        $$renderer3.push(`<!--]--></div> <div class="actions svelte-1qne1vi">`);
        if (status.withings.connected) {
          $$renderer3.push("<!--[0-->");
          Button($$renderer3, {
            size: "sm",
            variant: "secondary",
            loading: busy === "withings:sync",
            onclick: () => sync("withings"),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Importuj wagę`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!----> `);
          Button($$renderer3, {
            size: "sm",
            variant: "ghost",
            loading: busy === "withings:disc",
            onclick: () => disconnect("withings"),
            children: ($$renderer4) => {
              $$renderer4.push(`<!---->Rozłącz`);
            },
            $$slots: { default: true }
          });
          $$renderer3.push(`<!---->`);
        } else {
          $$renderer3.push("<!--[-1-->");
          $$renderer3.push(`<a class="connect svelte-1qne1vi" href="/api/integrations/withings/connect">Połącz z Withings</a>`);
        }
        $$renderer3.push(`<!--]--></div></div>`);
      }
    });
    $$renderer2.push(`<!----> <p class="note svelte-1qne1vi">Integracje działają teraz na danych demonstracyjnych. Po dodaniu kluczy API (Strava, Withings) do
    konfiguracji serwera połączą się z prawdziwymi kontami — bez zmian w kodzie.</p></div>`);
  });
}
function UpdateCard($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let status = null;
    let checking = false;
    let failed = false;
    let zone = void 0;
    const buildStamp = derived(() => formatInstant("2026-08-16T07:46:31.713Z", "dateTime", zone));
    async function check() {
      checking = true;
      failed = false;
      try {
        const res = await fetch("/api/version");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        status = await res.json();
      } catch {
        failed = true;
        status = null;
      } finally {
        checking = false;
      }
    }
    {
      let actions = function($$renderer3) {
        Button($$renderer3, {
          size: "sm",
          variant: "ghost",
          onclick: check,
          disabled: checking,
          children: ($$renderer4) => {
            $$renderer4.push(`<!---->${escape_html(checking ? "Sprawdzanie…" : "Sprawdź aktualizacje")}`);
          },
          $$slots: { default: true }
        });
      };
      Card($$renderer2, {
        title: "Wersja",
        subtitle: "Czy ta instalacja działa na najnowszym kodzie",
        actions,
        children: ($$renderer3) => {
          $$renderer3.push(`<dl class="rows svelte-1doi3sr"><div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Uruchomiona wersja</dt> <dd class="svelte-1doi3sr"><time${attr("datetime", "2026-08-16T07:46:31.713Z")}>${escape_html(buildStamp())}</time> `);
          {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<code class="sha svelte-1doi3sr">${escape_html("a9d13ec")}</code>`);
          }
          $$renderer3.push(`<!--]--></dd></div> `);
          if (checking) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Status</dt> <dd class="muted svelte-1doi3sr">`);
            Spinner($$renderer3, {});
            $$renderer3.push(`<!----> Pytam GitHuba…</dd></div>`);
          } else if (failed) {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Status</dt> <dd class="svelte-1doi3sr">`);
            Badge($$renderer3, {
              tone: "danger",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Nie udało się sprawdzić`);
              }
            });
            $$renderer3.push(`<!----></dd></div>`);
          } else if (status?.state === "not-configured") {
            $$renderer3.push("<!--[2-->");
            $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Status</dt> <dd class="svelte-1doi3sr">`);
            Badge($$renderer3, {
              tone: "neutral",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->Sprawdzanie nieskonfigurowane`);
              }
            });
            $$renderer3.push(`<!----> <p class="hint svelte-1doi3sr">Ustaw <code>GITHUB_TOKEN</code> w <code>.env</code> — repozytorium jest prywatne.</p></dd></div>`);
          } else if (status?.state === "unreachable") {
            $$renderer3.push("<!--[3-->");
            $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Status</dt> <dd class="svelte-1doi3sr">`);
            Badge($$renderer3, {
              tone: "warning",
              children: ($$renderer4) => {
                $$renderer4.push(`<!---->GitHub nieosiągalny`);
              }
            });
            $$renderer3.push(`<!----> <p class="hint svelte-1doi3sr">Spróbuj ponownie za chwilę.</p></dd></div>`);
          } else if (status?.state === "ok" && status.latest) {
            $$renderer3.push("<!--[4-->");
            $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Status</dt> <dd class="svelte-1doi3sr">`);
            if (status.behind) {
              $$renderer3.push("<!--[0-->");
              Badge($$renderer3, {
                tone: "warning",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->Dostępna nowsza wersja`);
                }
              });
            } else {
              $$renderer3.push("<!--[-1-->");
              Badge($$renderer3, {
                tone: "success",
                children: ($$renderer4) => {
                  $$renderer4.push(`<!---->Aktualna`);
                }
              });
            }
            $$renderer3.push(`<!--]--></dd></div> <div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Najnowszy commit</dt> <dd class="svelte-1doi3sr"><a${attr("href", status.latest.url)} target="_blank" rel="noreferrer noopener"><code class="sha svelte-1doi3sr">${escape_html(status.latest.sha)}</code></a> <span class="subject svelte-1doi3sr">${escape_html(status.latest.subject)}</span> <span class="muted svelte-1doi3sr">${escape_html(formatInstant(status.latest.committedAt, "dateTime", zone))}</span></dd></div> `);
            if (status.behind) {
              $$renderer3.push("<!--[0-->");
              $$renderer3.push(`<div class="row svelte-1doi3sr"><dt class="svelte-1doi3sr">Co dalej</dt> <dd class="hint svelte-1doi3sr">Wdrożenie jest ręczne: zaktualizuj kod na NAS-ie i uruchom stack ponownie. Ta karta tylko
            informuje — aplikacja celowo nie aktualizuje sama siebie.</dd></div>`);
            } else {
              $$renderer3.push("<!--[-1-->");
            }
            $$renderer3.push(`<!--]-->`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--></dl>`);
        }
      });
    }
  });
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data } = $$props;
    let disconnecting = false;
    let refreshing = false;
    async function refresh() {
      await invalidateAll();
    }
    async function refreshStatus() {
      refreshing = true;
      try {
        await invalidateAll();
      } finally {
        refreshing = false;
      }
    }
    async function disconnect() {
      disconnecting = true;
      try {
        await fetch("/api/garmin/disconnect", { method: "POST" });
        await invalidateAll();
      } finally {
        disconnecting = false;
      }
    }
    head("1i19ct2", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Ustawienia · Vagus</title>`);
      });
    });
    {
      let footer = function($$renderer3) {
        SyncFooter($$renderer3);
      };
      AppShell($$renderer2, {
        advanced: Boolean(data.advancedFeature?.enabled),
        title: "Ustawienia",
        footer,
        children: ($$renderer3) => {
          $$renderer3.push(`<div class="stack svelte-1i19ct2">`);
          {
            let connect = function($$renderer4) {
              SetupForm($$renderer4, { onConnected: refresh });
            };
            ConnectionCard($$renderer3, {
              status: data.health,
              onRefresh: refreshStatus,
              refreshing,
              onDisconnect: disconnect,
              disconnecting,
              connect
            });
          }
          $$renderer3.push(`<!----> `);
          McpUrlCard($$renderer3, { url: data.mcpUrl, connected: data.health.connected });
          $$renderer3.push(`<!----> `);
          if (data.advancedFeature) {
            $$renderer3.push("<!--[0-->");
            Card($$renderer3, {
              title: "Tryb zaawansowany",
              subtitle: "Włącz lub wyłącz przetwarzanie danych — pulpit, analitykę i wnioski. Wyłączenie wraca do trybu podstawowego.",
              children: ($$renderer4) => {
                AdvancedModeToggle($$renderer4, { feature: data.advancedFeature, onUpdated: refresh });
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (data.features.length > 0) {
            $$renderer3.push("<!--[0-->");
            Card($$renderer3, {
              title: "Funkcje i zgody",
              subtitle: "Włączaj i wyłączaj funkcje. Niektóre wymagają wcześniejszej akceptacji warunków.",
              children: ($$renderer4) => {
                $$renderer4.push(`<div class="features svelte-1i19ct2"><!--[-->`);
                const each_array = ensure_array_like(data.features);
                for (let i = 0, $$length = each_array.length; i < $$length; i++) {
                  let feature = each_array[i];
                  if (i > 0) {
                    $$renderer4.push("<!--[0-->");
                    $$renderer4.push(`<hr class="rule svelte-1i19ct2"/>`);
                  } else {
                    $$renderer4.push("<!--[-1-->");
                  }
                  $$renderer4.push(`<!--]--> `);
                  ConsentPanel($$renderer4, { feature, onUpdated: refresh });
                  $$renderer4.push(`<!---->`);
                }
                $$renderer4.push(`<!--]--></div>`);
              }
            });
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (data.integrations) {
            $$renderer3.push("<!--[0-->");
            $$renderer3.push(`<section class="integrations svelte-1i19ct2"><h2 class="section-title svelte-1i19ct2">Integracje</h2> `);
            IntegrationsPanel($$renderer3, { status: data.integrations });
            $$renderer3.push(`<!----></section>`);
          } else {
            $$renderer3.push("<!--[-1-->");
          }
          $$renderer3.push(`<!--]--> `);
          UpdateCard($$renderer3);
          $$renderer3.push(`<!----></div>`);
        }
      });
    }
  });
}
export {
  _page as default
};
