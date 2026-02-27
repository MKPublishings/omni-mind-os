(() => {
  const mainRoot = document.getElementById("main");
  const documentRoot = document.scrollingElement || document.documentElement;
  const prefersMainRoot = Boolean(
    mainRoot
      && mainRoot.scrollHeight > mainRoot.clientHeight
      && getComputedStyle(mainRoot).overflowY !== "visible"
  );
  const scrollRoot = prefersMainRoot ? mainRoot : documentRoot;
  const backToTopBtn = document.getElementById("docs-back-to-top");
  const docsNavEl = document.getElementById("docs-nav");
  const navLinks = Array.from(document.querySelectorAll(".docs-nav-link[href^='#']"));
  const sections = navLinks
    .map((link) => {
      const id = link.getAttribute("href")?.slice(1) || "";
      return document.getElementById(id);
    })
    .filter(Boolean);
  let activeScrollRaf = null;

  function setActiveById(id) {
    navLinks.forEach((link) => {
      const targetId = link.getAttribute("href")?.slice(1) || "";
      link.classList.toggle("is-active", targetId === id);
    });
  }

  function getSectionById(id) {
    return sections.find((section) => section.id === id) || null;
  }

  function getMaxScrollTop() {
    if (!scrollRoot) return 0;
    return Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
  }

  function getSectionTargetTop(section) {
    if (!scrollRoot || !section) return 0;
    const maxTop = getMaxScrollTop();
    const rootRectTop = scrollRoot === documentRoot ? 0 : scrollRoot.getBoundingClientRect().top;
    const desiredTop = Math.max(
      0,
      scrollRoot.scrollTop + section.getBoundingClientRect().top - rootRectTop - 12
    );
    return Math.min(desiredTop, maxTop);
  }

  function isBottomZoneTarget(section) {
    if (!section) return false;
    const index = sections.indexOf(section);
    return index >= Math.max(0, sections.length - 3);
  }

  function animateScrollTo(top, duration = 180) {
    if (!scrollRoot) return;

    if (activeScrollRaf) {
      cancelAnimationFrame(activeScrollRaf);
      activeScrollRaf = null;
    }

    const startTop = scrollRoot.scrollTop;
    const delta = top - startTop;
    if (Math.abs(delta) < 1) {
      scrollRoot.scrollTop = top;
      return;
    }

    const startTime = performance.now();
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      scrollRoot.scrollTop = startTop + delta * eased;

      if (progress < 1) {
        activeScrollRaf = requestAnimationFrame(tick);
      } else {
        scrollRoot.scrollTop = top;
        activeScrollRaf = null;
      }
    };

    activeScrollRaf = requestAnimationFrame(tick);
  }

  function scrollToSection(section, smooth = true) {
    if (!scrollRoot || !section) return;
    const top = getSectionTargetTop(section);
    const maxTop = getMaxScrollTop();
    const atBottom = top >= maxTop - 2;
    const isBottomZone = isBottomZoneTarget(section);

    if (!smooth) {
      if (activeScrollRaf) {
        cancelAnimationFrame(activeScrollRaf);
        activeScrollRaf = null;
      }
      scrollRoot.scrollTo({ top, behavior: "auto" });
      return;
    }

    if (isBottomZone || atBottom) {
      animateScrollTo(top, 180);
      return;
    }

    scrollRoot.scrollTo({ top, behavior: "smooth" });
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
    const rootRectTop = scrollRoot === documentRoot ? 0 : scrollRoot.getBoundingClientRect().top;

    for (const section of sections) {
      const sectionTop = scrollRoot.scrollTop + section.getBoundingClientRect().top - rootRectTop;
      if (sectionTop - offset <= currentY) {
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
    if (scrollRoot) {
      const maxTop = getMaxScrollTop();
      if (scrollRoot.scrollTop > maxTop) {
        scrollRoot.scrollTop = maxTop;
      }
    }

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

      scrollToSection(target, true);
      setActiveById(id);
    });
  });

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
        scrollToSection(target, false);
        setActiveById(hashId);
      });
    }
  }
})();
