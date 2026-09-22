/* THEME 10 — "Ironside" front-end behaviours. Sections are inlined at
   generation time, so there is no client-side component loading.

   Lead capture on static city/state exports is NOT handled here: forms carry
   `data-rl-lead` and the shared central injector adds the config, capture JS,
   honeypot and Turnstile at export time. This file powers the presentational
   behaviours plus the nationwide/subdomain self-contained lead handler
   (`data-t8-form`), which the dynamic renderer needs because the export-time
   injector does not run there. */

function initNavigation() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.querySelector(".nav-links");
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("open", open);
    document.body.classList.toggle("menu-open", open);
  };
  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

/* Copy a service-offer code to the clipboard (concept "Copy offer" buttons). */
function initOfferCodes() {
  document.querySelectorAll("[data-copy-code]").forEach((button) => {
    const original = button.innerHTML;
    button.addEventListener("click", async () => {
      const code = button.dataset.copyCode || "";
      try {
        await navigator.clipboard.writeText(code);
        button.textContent = "Copied " + code + " ✓";
      } catch (_e) {
        button.textContent = "Code: " + code;
      }
      setTimeout(() => {
        button.innerHTML = original;
      }, 2600);
    });
  });
}

/* Newsletter is a presentational-only sign-up (not a lead form). */
function initNewsletter() {
  const form = document.getElementById("newsletter-form");
  if (!form) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    if (button) {
      button.textContent = "You're on the list ✓";
      button.disabled = true;
    }
  });
}

/* Scroll-reveal without any external library (replaces the concept's sal.js).
   Adds `.sal-animate` as each [data-sal] element scrolls into view; honours
   data-sal-delay and prefers-reduced-motion, and degrades to "show all" when
   IntersectionObserver is unavailable. */
function initReveal() {
  var els = document.querySelectorAll("[data-sal]");
  if (!els.length) return;
  var reduce =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (el) {
      el.classList.add("sal-animate");
    });
    return;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseInt(el.getAttribute("data-sal-delay") || "0", 10);
        if (delay) el.style.transitionDelay = delay + "ms";
        el.classList.add("sal-animate");
        io.unobserve(el);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
  );
  els.forEach(function (el) {
    io.observe(el);
  });
}

/* Lead capture for NATIONWIDE / SUBDOMAIN pages (data-t8-form). Static
   city/state exports carry `data-rl-lead` and are wired by the shared
   export-time injector — that injector does NOT run for the dynamic nationwide
   renderer, so those pages ship this self-contained handler instead. Config,
   when present, arrives via `window.__RL_LEADS`; without it the form still
   shows the success state. */
function leadsConfig() {
  var c = window.__RL_LEADS || {};
  var base = String(c.apiBase || "");
  var siteId = String(c.siteId || "");
  if (!/^https?:\/\//.test(base)) return null;
  if (!siteId || siteId.indexOf("{{") !== -1) return null;
  var key = String(c.turnstileSiteKey || "");
  if (!key || key.indexOf("{{") !== -1) key = "";
  return {
    apiBase: base.replace(/\/+$/, ""),
    siteId: siteId,
    turnstileSiteKey: key,
  };
}

var _tsState = { loading: false, loaded: false, queue: [] };
function loadTurnstile(cb) {
  if (_tsState.loaded && window.turnstile) return cb();
  _tsState.queue.push(cb);
  if (_tsState.loading) return;
  _tsState.loading = true;
  window.__rlTurnstileReady = function () {
    _tsState.loaded = true;
    _tsState.queue.forEach(function (f) {
      f();
    });
    _tsState.queue = [];
  };
  var s = document.createElement("script");
  s.src =
    "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__rlTurnstileReady&render=explicit";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}
function mountTurnstile(form, siteKey) {
  if (!siteKey || form.__rlTs) return;
  form.__rlTs = true;
  var box = document.createElement("div");
  box.className = "rl-turnstile";
  var submit = form.querySelector('button[type="submit"]');
  if (submit && submit.parentNode) submit.parentNode.insertBefore(box, submit);
  else form.appendChild(box);
  loadTurnstile(function () {
    if (window.turnstile) window.turnstile.render(box, { sitekey: siteKey });
  });
}
function initLeadForms() {
  var cfg = leadsConfig();
  document.querySelectorAll("form[data-t8-form]").forEach((form) => {
    if (cfg && cfg.turnstileSiteKey) {
      form.addEventListener(
        "focusin",
        function () {
          mountTurnstile(form, cfg.turnstileSiteKey);
        },
        { once: true },
      );
    }
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      const hp = form.querySelector('[name="_hp"]');
      const isBot = hp && hp.value;
      if (cfg && !isBot) {
        const data = {};
        new FormData(form).forEach((value, key) => {
          if (key === "_hp") return;
          data[key] = typeof value === "string" ? value : String(value);
        });
        data.pageUrl = window.location.href;
        const tokenInput = form.querySelector('[name="cf-turnstile-response"]');
        if (tokenInput && tokenInput.value) data.turnstileToken = tokenInput.value;
        try {
          fetch(cfg.apiBase + "/api/leads/" + encodeURIComponent(cfg.siteId), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
            keepalive: true,
          }).catch(() => {});
        } catch (_e) {
          /* ignore — still show success below */
        }
      }
      form.querySelector(".form-success")?.classList.add("visible");
      if (submit) {
        submit.disabled = true;
        submit.innerHTML = "Request received ✓";
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initOfferCodes();
  initNewsletter();
  initLeadForms();
  initReveal();
});
