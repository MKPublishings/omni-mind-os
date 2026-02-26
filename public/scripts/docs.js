(() => {
  const scrollRoot = document.getElementById("main");
  const backToTopBtn = document.getElementById("docs-back-to-top");
  const docsNavEl = document.getElementById("docs-nav");
  const navLinks = Array.from(document.querySelectorAll(".docs-nav-link[href^='#']"));
  const sections = navLinks
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1) || "";
      return document.getElementById(id);
    })
    .filter(Boolean);

  function setActiveById(id) {
    navLinks.forEach((link) => {
      const targetId = link.getAttribute("href")?.slice(1) || "";
      link.classList.toggle("is-active", targetId === id);
    });
  }

  function getSectionById(id) {
    return sections.find((section) => section.id === id) || null;
  }

  function syncSidebarProgress() {
    if (!scrollRoot || !docsNavEl) return;

    const pageScrollable = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
    const navScrollable = Math.max(0, docsNavEl.scrollHeight - docsNavEl.clientHeight);
    if (pageScrollable <= 0 || navScrollable <= 0) {
      docsNavEl.scrollTop = 0;
      return;
    }

    const progress = scrollRoot.scrollTop / pageScrollable;
    docsNavEl.scrollTop = navScrollable * Math.min(1, Math.max(0, progress));
  }

  function computeActiveSectionId() {
    if (!scrollRoot || !sections.length) return sections[0]?.id || "";

    const currentY = scrollRoot.scrollTop;
    const offset = 130;
    let activeId = sections[0].id;

    for (const section of sections) {
      if (section.offsetTop - offset <= currentY) {
        activeId = section.id;
      } else {
        break;
      }
    }

    if (currentY + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2) {
      activeId = sections[sections.length - 1].id;
    }

    return activeId;
  }

  function updateActiveFromScroll() {
    const activeId = computeActiveSectionId();
    if (activeId) setActiveById(activeId);
    syncSidebarProgress();
  }

  if (scrollRoot && sections.length) {
    scrollRoot.addEventListener("scroll", updateActiveFromScroll, { passive: true });
    updateActiveFromScroll();
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const id = link.getAttribute("href")?.slice(1) || "";
      if (!id) return;

      const target = document.getElementById(id);
      if (!target) return;

      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
        inline: "nearest"
      });
      setActiveById(id);
    });
  });

  if (docsNavEl && scrollRoot) {
    docsNavEl.addEventListener(
      "wheel",
      (event) => {
        const navScrollable = Math.max(0, docsNavEl.scrollHeight - docsNavEl.clientHeight);
        if (navScrollable <= 0) return;
        event.preventDefault();
        scrollRoot.scrollTop += event.deltaY;
      },
      { passive: false }
    );
  }

  if (scrollRoot && backToTopBtn) {
    const updateBackToTopVisibility = () => {
      const shouldShow = scrollRoot.scrollTop > 320;
      backToTopBtn.classList.toggle("is-visible", shouldShow);
    };

    scrollRoot.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
    updateBackToTopVisibility();

    backToTopBtn.addEventListener("click", () => {
      scrollRoot.scrollTo({ top: 0, behavior: "smooth" });
      setActiveById("overview");
    });
  }

  const hashId = window.location.hash.replace("#", "").trim();
  if (hashId) {
    const target = getSectionById(hashId);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
        setActiveById(hashId);
      });
    }
  }
})();
