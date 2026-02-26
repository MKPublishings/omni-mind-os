(() => {
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
        root: null,
        rootMargin: "-20% 0px -60% 0px",
        threshold: [0.2, 0.45, 0.7]
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const id = link.getAttribute("href")?.slice(1) || "";
      if (id) setActiveById(id);
    });
  });
})();
