(() => {
  const scrollRoot = document.getElementById("main");
  const backToTopBtn = document.getElementById("docs-back-to-top");
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

  if (sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        setActiveById(visible.target.id);
      },
      {
        root: scrollRoot || null,
        rootMargin: "-15% 0px -68% 0px",
        threshold: [0.2, 0.45, 0.7]
      }
    );

    sections.forEach((section) => observer.observe(section));
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
})();
