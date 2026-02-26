(() => {
  const page = document.body;
  if (!page) return;

  const SETTINGS_KEYS = {
    ANIMATIONS: "omni-animations",
    HIGH_CONTRAST_MODE: "omni-high-contrast",
    REDUCE_GLASS_BLUR: "omni-reduce-glass"
  };

  function getSettingBool(key, fallback = false) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return fallback;
      return value === "true";
    } catch {
      return fallback;
    }
  }

  function applyInterfaceFlags() {
    page.classList.toggle("page-high-contrast", getSettingBool(SETTINGS_KEYS.HIGH_CONTRAST_MODE, false));
    page.classList.toggle("page-reduce-glass", getSettingBool(SETTINGS_KEYS.REDUCE_GLASS_BLUR, false));
  }

  applyInterfaceFlags();

  window.addEventListener("storage", (event) => {
    if (
      event.key === SETTINGS_KEYS.HIGH_CONTRAST_MODE ||
      event.key === SETTINGS_KEYS.REDUCE_GLASS_BLUR
    ) {
      applyInterfaceFlags();
    }
  });

  window.addEventListener("omni-settings-changed", (event) => {
    const key = event?.detail?.key;
    if (key === SETTINGS_KEYS.HIGH_CONTRAST_MODE || key === SETTINGS_KEYS.REDUCE_GLASS_BLUR) {
      applyInterfaceFlags();
    }
  });

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animationsEnabled = getSettingBool(SETTINGS_KEYS.ANIMATIONS, true);
  if (prefersReducedMotion || !animationsEnabled) {
    page.classList.add("page-no-motion");
    return;
  }

  const rawMs = getComputedStyle(page).getPropertyValue("--site-transition-ms");
  const transitionMs = Number.parseFloat(rawMs) || 140;

  let navigating = false;

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#")) return;
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.href === window.location.href) return;

    event.preventDefault();
    if (navigating) return;

    navigating = true;
    page.classList.add("page-leave");

    window.setTimeout(() => {
      window.location.assign(url.href);
    }, transitionMs);
  });
})();
