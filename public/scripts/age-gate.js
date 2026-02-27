(() => {
  const STORAGE_KEY = "omni-age-profile-v1";
  const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function readStoredProfile() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = safeJsonParse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function computeAge(year, month, day, now = new Date()) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return -1;

    const dob = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dob.getTime())) return -1;
    if (dob.getUTCFullYear() !== y || dob.getUTCMonth() !== m - 1 || dob.getUTCDate() !== d) return -1;

    const nowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (dob.getTime() > nowUtc.getTime()) return -1;

    let age = nowUtc.getUTCFullYear() - dob.getUTCFullYear();
    const monthDiff = nowUtc.getUTCMonth() - dob.getUTCMonth();
    const dayDiff = nowUtc.getUTCDate() - dob.getUTCDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age;
  }

  function writeProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // ignore storage failures
    }
  }

  function applyProfileToDom(profile) {
    const tier = String(profile?.ageTier || "minor");
    const nsfwUnlocked = profile?.nsfwAccess === true;
    document.documentElement.dataset.ageTier = tier;
    document.documentElement.dataset.nsfwAccess = nsfwUnlocked ? "enabled" : "disabled";

    window.dispatchEvent(
      new CustomEvent("omni-age-profile-changed", {
        detail: profile
      })
    );
  }

  function buildNormalizedStoredProfile(profile) {
    if (!profile || typeof profile !== "object") return null;
    const dob = profile?.dob;
    if (!dob || typeof dob !== "object") return null;

    const year = Number(dob.year);
    const month = Number(dob.month);
    const day = Number(dob.day);
    const age = computeAge(year, month, day);
    if (age < 0) return null;

    const isAdult = age >= 18;
    return {
      verified: true,
      humanVerified: Boolean(profile.humanVerified),
      verifiedAt: Number(profile.verifiedAt || Date.now()),
      dob: { year, month, day },
      age,
      ageTier: isAdult ? "adult" : "minor",
      nsfwAccess: Boolean(profile.humanVerified) && isAdult,
      illegalContentBlocked: true
    };
  }

  function ensureTurnstileScript() {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      const existing = document.querySelector('script[data-omni-turnstile="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.turnstile));
        existing.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
        return;
      }

      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.omniTurnstile = "true";
      script.addEventListener("load", () => resolve(window.turnstile));
      script.addEventListener("error", () => reject(new Error("Turnstile failed to load")));
      document.head.appendChild(script);
    });
  }

  async function fetchTurnstileSiteKey() {
    const meta = document.querySelector('meta[name="omni-turnstile-site-key"]');
    const fromMeta = String(meta?.getAttribute("content") || "").trim();
    if (fromMeta) return fromMeta;

    if (typeof window.OMNI_TURNSTILE_SITE_KEY === "string" && window.OMNI_TURNSTILE_SITE_KEY.trim()) {
      return window.OMNI_TURNSTILE_SITE_KEY.trim();
    }

    try {
      const response = await fetch("/api/human-verify/config", { method: "GET" });
      if (!response.ok) return "";
      const data = await response.json();
      return String(data?.siteKey || "").trim();
    } catch {
      return "";
    }
  }

  function createModalMarkup() {
    const overlay = document.createElement("div");
    overlay.className = "age-gate-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "age-gate-title");

    overlay.innerHTML = `
      <div class="age-gate-modal">
        <h2 id="age-gate-title">Age Verification Required</h2>
        <p class="age-gate-copy">Confirm your birth date to continue. Adult-only access remains restricted to verified users who are 18+.</p>
        <form id="age-gate-form" class="age-gate-form" novalidate>
          <div class="age-gate-wheel">
            <label class="age-gate-label" for="age-month">Month</label>
            <select id="age-month" required></select>
          </div>
          <div class="age-gate-wheel">
            <label class="age-gate-label" for="age-day">Day</label>
            <select id="age-day" required></select>
          </div>
          <div class="age-gate-wheel">
            <label class="age-gate-label" for="age-year">Year</label>
            <select id="age-year" required></select>
          </div>
          <div id="age-gate-turnstile" class="age-gate-turnstile"></div>
          <p id="age-gate-status" class="age-gate-status" aria-live="polite"></p>
          <button id="age-gate-submit" type="submit" class="age-gate-submit">Verify & Continue</button>
        </form>
      </div>
    `;

    return overlay;
  }

  function fillMonthOptions(select) {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December"
    ];

    select.innerHTML = months
      .map((name, index) => `<option value="${index + 1}">${name}</option>`)
      .join("");
  }

  function fillYearOptions(select) {
    const currentYear = new Date().getUTCFullYear();
    const oldestYear = currentYear - 122;
    const years = [];

    for (let year = currentYear; year >= oldestYear; year -= 1) {
      years.push(`<option value="${year}">${year}</option>`);
    }

    select.innerHTML = years.join("");
  }

  function fillDayOptions(select, year, month) {
    const total = daysInMonth(year, month);
    const current = Number(select.value || 1);
    const options = [];
    for (let day = 1; day <= total; day += 1) {
      options.push(`<option value="${day}">${day}</option>`);
    }
    select.innerHTML = options.join("");
    select.value = String(Math.min(current, total));
  }

  async function runGate() {
    const stored = buildNormalizedStoredProfile(readStoredProfile());
    if (stored && stored.verified) {
      applyProfileToDom(stored);
      return;
    }

    document.body.classList.add("age-gate-locked");

    const modal = createModalMarkup();
    document.body.appendChild(modal);

    const form = modal.querySelector("#age-gate-form");
    const monthSelect = modal.querySelector("#age-month");
    const daySelect = modal.querySelector("#age-day");
    const yearSelect = modal.querySelector("#age-year");
    const statusEl = modal.querySelector("#age-gate-status");
    const submitBtn = modal.querySelector("#age-gate-submit");
    const turnstileTarget = modal.querySelector("#age-gate-turnstile");

    fillMonthOptions(monthSelect);
    fillYearOptions(yearSelect);
    fillDayOptions(daySelect, Number(yearSelect.value), Number(monthSelect.value));

    monthSelect.addEventListener("change", () => {
      fillDayOptions(daySelect, Number(yearSelect.value), Number(monthSelect.value));
    });

    yearSelect.addEventListener("change", () => {
      fillDayOptions(daySelect, Number(yearSelect.value), Number(monthSelect.value));
    });

    let token = "";
    let turnstileRequired = true;

    try {
      const siteKey = await fetchTurnstileSiteKey();
      if (!siteKey) {
        turnstileRequired = false;
        statusEl.textContent = "Human verification key is not configured. Date verification only is active.";
      } else {
        await ensureTurnstileScript();
        if (window.turnstile && turnstileTarget) {
          window.turnstile.render(turnstileTarget, {
            sitekey: siteKey,
            theme: "dark",
            callback: (value) => {
              token = String(value || "").trim();
              if (token) {
                statusEl.textContent = "Human verification complete.";
              }
            },
            "expired-callback": () => {
              token = "";
              statusEl.textContent = "Human verification expired. Please verify again.";
            },
            "error-callback": () => {
              token = "";
              statusEl.textContent = "Human verification failed. Please retry.";
            }
          });
        }
      }
    } catch {
      turnstileRequired = false;
      statusEl.textContent = "Human verification service unavailable. Date verification only is active.";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const year = Number(yearSelect.value);
      const month = Number(monthSelect.value);
      const day = Number(daySelect.value);

      const age = computeAge(year, month, day);
      if (age < 0) {
        statusEl.textContent = "Please select a valid birth date.";
        return;
      }

      if (turnstileRequired && !token) {
        statusEl.textContent = "Complete the human verification before continuing.";
        return;
      }

      submitBtn.disabled = true;
      statusEl.textContent = "Verifying your access profile...";

      try {
        const response = await fetch("/api/human-verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            token,
            birthDate: { year, month, day }
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.ok) {
          statusEl.textContent = String(data?.error || "Verification failed. Try again.");
          submitBtn.disabled = false;
          return;
        }

        const profile = {
          verified: true,
          humanVerified: Boolean(data.humanVerified),
          verifiedAt: Date.now(),
          dob: { year, month, day },
          age: Number(data.age || age),
          ageTier: data.isAdult ? "adult" : "minor",
          nsfwAccess: Boolean(data.nsfwAccess),
          illegalContentBlocked: true
        };

        writeProfile(profile);
        applyProfileToDom(profile);

        statusEl.textContent = profile.nsfwAccess
          ? "Verification complete. 18+ access profile enabled."
          : "Verification complete. Safety guardrails remain enabled.";

        setTimeout(() => {
          document.body.classList.remove("age-gate-locked");
          modal.remove();
        }, 250);
      } catch {
        statusEl.textContent = "Verification request failed. Please retry.";
        submitBtn.disabled = false;
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runGate);
  } else {
    runGate();
  }
})();