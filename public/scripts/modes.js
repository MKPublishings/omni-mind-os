console.log("modes.js loaded");

// ==============================================
// MODE SECTION INTERACTIONS
// ==============================================

// Smooth scroll reveal animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px"
};

const modeSections = document.querySelectorAll(".mode-section");

if (modeSections.length > 0 && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "0";
        entry.target.style.transform = "translateY(20px)";
        
        // Trigger animation
        requestAnimationFrame(() => {
          entry.target.style.transition = "opacity 0.6s ease, transform 0.6s ease";
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        });
        
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  modeSections.forEach((section, index) => {
    // Stagger initial state
    section.style.opacity = "0";
    section.style.transform = "translateY(20px)";
    observer.observe(section);
  });
}

// ==============================================
// MODE BADGE CLICK TO COPY MODE NAME
// ==============================================

const modeBadges = document.querySelectorAll(".mode-badge");
modeBadges.forEach((badge) => {
  badge.style.cursor = "pointer";
  badge.addEventListener("click", () => {
    const modeSection = badge.closest(".mode-section");
    const modeName = modeSection?.dataset.mode || "unknown";
    
    // Copy to clipboard
    navigator.clipboard.writeText(modeName).then(() => {
      const originalText = badge.textContent;
      badge.textContent = "Copied!";
      badge.style.background = "linear-gradient(135deg, rgba(15, 82, 186, 0.95), rgba(0, 0, 0, 0.9))";
      
      setTimeout(() => {
        badge.textContent = originalText;
        badge.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(0, 0, 0, 0.88))";
      }, 1500);
    });
  });
});

// ==============================================
// USE CASE TAG INTERACTIONS
// ==============================================

const useCaseTags = document.querySelectorAll(".use-case-tag");
useCaseTags.forEach((tag) => {
  tag.addEventListener("click", () => {
    const useCase = tag.textContent.trim();
    
    // Visual feedback
    tag.style.background = "rgba(255, 115, 115, 0.24)";
    tag.style.borderColor = "rgba(255, 115, 115, 0.56)";
    
    setTimeout(() => {
      tag.style.background = "rgba(255, 115, 115, 0.12)";
      tag.style.borderColor = "rgba(255, 115, 115, 0.28)";
    }, 200);
    
    console.log(`Selected use case: ${useCase}`);
  });
});

// ==============================================
// KEYBOARD NAVIGATION
// ==============================================

let currentModeIndex = -1;

document.addEventListener("keydown", (e) => {
  // Navigate modes with arrow keys
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    
    if (e.key === "ArrowDown") {
      currentModeIndex = Math.min(currentModeIndex + 1, modeSections.length - 1);
    } else {
      currentModeIndex = Math.max(currentModeIndex - 1, 0);
    }
    
    if (modeSections[currentModeIndex]) {
      modeSections[currentModeIndex].scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
      
      // Subtle highlight effect
      modeSections[currentModeIndex].style.borderColor = "rgba(255, 115, 115, 0.72)";
      setTimeout(() => {
        modeSections[currentModeIndex].style.borderColor = "";
      }, 800);
    }
  }
});

// ==============================================
// FEATURE LIST STAGGER ANIMATION ON HOVER
// ==============================================

const featureLists = document.querySelectorAll(".feature-list");
featureLists.forEach((list) => {
  const items = list.querySelectorAll("li");
  
  list.addEventListener("mouseenter", () => {
    items.forEach((item, index) => {
      item.style.transition = `all 0.3s ease ${index * 0.05}s`;
    });
  });
});

// ==============================================
// DYNAMIC MODE COLORS
// ==============================================

const modeColors = {
  architect: { primary: "59, 130, 246", name: "Architect" },
  analyst: { primary: "34, 197, 94", name: "Analyst" },
  visual: { primary: "168, 85, 247", name: "Visual" },
  lore: { primary: "244, 208, 161", name: "Lore" },
  reasoning: { primary: "20, 184, 166", name: "Reasoning" },
  coding: { primary: "99, 102, 241", name: "Coding" },
  knowledge: { primary: "234, 179, 8", name: "Knowledge" },
  "system-knowledge": { primary: "148, 163, 184", name: "System Knowledge" }
};

modeSections.forEach((section) => {
  const mode = section.dataset.mode;
  const color = modeColors[mode];
  
  if (color) {
    section.addEventListener("mouseenter", () => {
      section.style.setProperty("--mode-accent", `rgba(${color.primary}, 0.5)`);
    });
    
    section.addEventListener("mouseleave", () => {
      section.style.removeProperty("--mode-accent");
    });
  }
});

console.log("Modes page initialized with", modeSections.length, "cognitive modes");
