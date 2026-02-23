(() => {
  const page = document.body;
  if (!page) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

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
