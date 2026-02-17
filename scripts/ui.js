console.log("ui.js loaded");

const root = document.documentElement;
const themeSelect = document.getElementById("theme-select");

if (themeSelect) {
  const saved = localStorage.getItem("omni-theme");
  if (saved) {
    root.className = saved;
    themeSelect.value = saved;
  }

  themeSelect.addEventListener("change", () => {
    const theme = themeSelect.value;
    root.className = theme === "dark" ? "" : theme;
    localStorage.setItem("omni-theme", theme);
  });
}

document.querySelectorAll(".nav-link").forEach((link) => {
  if (link.href === window.location.href) {
    link.classList.add("active");
  }
});
document.body.classList.add("fade-ready");
setTimeout(() => {
  document.body.classList.add("fade-in");
}, 10);

const aura = document.createElement("div");
aura.className = "cursor-aura";
document.body.appendChild(aura);

document.addEventListener("mousemove", (e) => {
  aura.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
});