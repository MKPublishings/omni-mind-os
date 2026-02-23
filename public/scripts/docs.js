console.log("docs.js loaded");

// ==============================================
// TABLE OF CONTENTS NAVIGATION
// ==============================================

const tocLinks = document.querySelectorAll(".toc-link");
const docSections = document.querySelectorAll(".doc-section");

// Update active TOC link based on scroll position
function updateActiveTOCLink() {
  let currentSection = "";
  
  docSections.forEach((section) => {
    const sectionTop = section.offsetTop;
    const sectionHeight = section.clientHeight;
    
    if (window.scrollY >= sectionTop - 100) {
      currentSection = section.getAttribute("id");
    }
  });
  
  tocLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-section") === currentSection) {
      link.classList.add("active");
    }
  });
}

// Smooth scroll to section on TOC link click
tocLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = link.getAttribute("data-section");
    const targetSection = document.getElementById(targetId);
    
    if (targetSection) {
      const offsetTop = targetSection.offsetTop - 40;
      window.scrollTo({
        top: offsetTop,
        behavior: "smooth"
      });
      
      // Update URL hash
      history.pushState(null, null, `#${targetId}`);
    }
  });
});

// Listen to scroll events
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(updateActiveTOCLink, 50);
});

// Initialize on load
updateActiveTOCLink();

// Handle initial hash navigation
if (window.location.hash) {
  const initialSection = document.querySelector(window.location.hash);
  if (initialSection) {
    setTimeout(() => {
      initialSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }
}

// ==============================================
// CODE BLOCK COPY FUNCTIONALITY
// ==============================================

const codeBlocks = document.querySelectorAll(".code-block pre");

codeBlocks.forEach((block) => {
  // Create copy button
  const copyButton = document.createElement("button");
  copyButton.textContent = "Copy";
  copyButton.className = "copy-code-btn";
  copyButton.style.cssText = `
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 6px 12px;
    background: rgba(255, 115, 115, 0.18);
    border: 1px solid rgba(255, 115, 115, 0.32);
    color: #ff7373;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.15s ease;
  `;
  
  // Make parent relative for absolute positioning
  block.parentElement.style.position = "relative";
  block.parentElement.appendChild(copyButton);
  
  copyButton.addEventListener("click", () => {
    const code = block.textContent;
    navigator.clipboard.writeText(code).then(() => {
      copyButton.textContent = "Copied!";
      copyButton.style.background = "rgba(34, 197, 94, 0.18)";
      copyButton.style.borderColor = "rgba(34, 197, 94, 0.32)";
      copyButton.style.color = "#22c55e";
      
      setTimeout(() => {
        copyButton.textContent = "Copy";
        copyButton.style.background = "rgba(255, 115, 115, 0.18)";
        copyButton.style.borderColor = "rgba(255, 115, 115, 0.32)";
        copyButton.style.color = "#ff7373";
      }, 2000);
    });
  });
  
  copyButton.addEventListener("mouseenter", () => {
    copyButton.style.background = "rgba(255, 115, 115, 0.28)";
    copyButton.style.transform = "translateY(-2px)";
  });
  
  copyButton.addEventListener("mouseleave", () => {
    copyButton.style.background = "rgba(255, 115, 115, 0.18)";
    copyButton.style.transform = "translateY(0)";
  });
});

// ==============================================
// KEYBOARD NAVIGATION
// ==============================================

let currentSectionIndex = -1;

document.addEventListener("keydown", (e) => {
  // Navigate sections with arrow keys (Ctrl/Cmd + Arrow)
  if ((e.ctrlKey || e.metaKey) && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    e.preventDefault();
    
    if (e.key === "ArrowDown") {
      currentSectionIndex = Math.min(currentSectionIndex + 1, docSections.length - 1);
    } else {
      currentSectionIndex = Math.max(currentSectionIndex - 1, 0);
    }
    
    if (docSections[currentSectionIndex]) {
      docSections[currentSectionIndex].scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }
  
  // Jump to top with Ctrl/Cmd + Home
  if ((e.ctrlKey || e.metaKey) && e.key === "Home") {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

// ==============================================
// SECTION SCROLL REVEAL ANIMATIONS
// ==============================================

if ("IntersectionObserver" in window) {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -100px 0px"
  };
  
  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        sectionObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  docSections.forEach((section) => {
    section.style.opacity = "0";
    section.style.transform = "translateY(30px)";
    section.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    sectionObserver.observe(section);
  });
}

// ==============================================
// EXTERNAL LINK INDICATORS
// ==============================================

const contentLinks = document.querySelectorAll(".docs-content a[href^='http']");
contentLinks.forEach((link) => {
  link.setAttribute("target", "_blank");
  link.setAttribute("rel", "noopener noreferrer");
  
  // Add external icon
  if (!link.querySelector(".external-icon")) {
    const icon = document.createElement("span");
    icon.className = "external-icon";
    icon.textContent = " ↗";
    icon.style.fontSize = "0.85em";
    icon.style.opacity = "0.6";
    link.appendChild(icon);
  }
});

// ==============================================
// TABLE OF CONTENTS COLLAPSE (Mobile)
// ==============================================

if (window.innerWidth <= 900) {
  const tocTitle = document.querySelector(".toc-title");
  const tocNav = document.querySelector(".toc-nav");
  
  if (tocTitle && tocNav) {
    tocTitle.style.cursor = "pointer";
    tocTitle.style.userSelect = "none";
    
    // Add arrow indicator
    const arrow = document.createElement("span");
    arrow.textContent = " ▼";
    arrow.style.fontSize = "0.8em";
    arrow.style.marginLeft = "8px";
    tocTitle.appendChild(arrow);
    
    // Start collapsed on mobile
    tocNav.style.display = "none";
    arrow.textContent = " ▶";
    
    tocTitle.addEventListener("click", () => {
      if (tocNav.style.display === "none") {
        tocNav.style.display = "flex";
        arrow.textContent = " ▼";
      } else {
        tocNav.style.display = "none";
        arrow.textContent = " ▶";
      }
    });
  }
}

// ==============================================
// READING PROGRESS INDICATOR
// ==============================================

const progressBar = document.createElement("div");
progressBar.style.cssText = `
  position: fixed;
  top: 0;
  left: 0;
  width: 0%;
  height: 3px;
  background: linear-gradient(90deg, #ff7373, #f4d0a1);
  z-index: 9999;
  transition: width 0.1s ease;
  box-shadow: 0 0 10px rgba(255, 115, 115, 0.5);
`;
document.body.appendChild(progressBar);

window.addEventListener("scroll", () => {
  const windowHeight = window.innerHeight;
  const documentHeight = document.documentElement.scrollHeight - windowHeight;
  const scrolled = window.scrollY;
  const progress = (scrolled / documentHeight) * 100;
  
  progressBar.style.width = `${Math.min(progress, 100)}%`;
});

// ==============================================
// SEARCH FUNCTIONALITY (Future Enhancement)
// ==============================================

// Placeholder for future search implementation
function initializeSearch() {
  // TODO: Add fuzzy search across all doc sections
  console.log("Search functionality ready for implementation");
}

// Initialize
console.log("Documentation page initialized with", docSections.length, "sections");
console.log("Keyboard shortcuts: Ctrl/Cmd + ↑/↓ to navigate, Ctrl/Cmd + Home to jump to top");
