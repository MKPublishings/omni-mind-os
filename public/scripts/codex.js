(() => {
  const statsEntries = document.getElementById("codex-stat-entries");
  const statsLinks = document.getElementById("codex-stat-links");
  const statsChambers = document.getElementById("codex-stat-chambers");
  const statsGenerated = document.getElementById("codex-stat-generated");
  const chamberButtonsRoot = document.getElementById("codex-chamber-buttons");
  const graphInsightRoot = document.getElementById("codex-graph-insight");
  const entryListRoot = document.getElementById("codex-entry-list");
  const searchInput = document.getElementById("codex-search");
  const resultCount = document.getElementById("codex-result-count");

  const state = {
    index: null,
    selectedChamber: "all",
    search: ""
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDate(isoDate) {
    if (!isoDate) return "--";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "--";
    return date.toLocaleString();
  }

  function getEntries() {
    return Array.isArray(state.index?.entries) ? state.index.entries : [];
  }

  function getCrossLinks() {
    return Array.isArray(state.index?.crossLinks) ? state.index.crossLinks : [];
  }

  function toChamber(entry) {
    const category = String(entry?.category || "unknown");
    return category.split("/")[0] || "unknown";
  }

  function getChamberCounts(entries) {
    const counts = new Map();
    for (const entry of entries) {
      const chamber = toChamber(entry);
      counts.set(chamber, (counts.get(chamber) || 0) + 1);
    }
    return counts;
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      const left = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const right = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return right - left;
    });
  }

  function filterEntries(entries) {
    const chamber = state.selectedChamber;
    const query = state.search.trim().toLowerCase();

    return entries.filter((entry) => {
      if (chamber !== "all" && toChamber(entry) !== chamber) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        entry.id,
        entry.title,
        entry.path,
        entry.category,
        ...(entry.tags || []),
        ...(entry.links || []),
        ...(entry.autoLinks || [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }

  function renderStats(entries, crossLinks) {
    const generatedAt = state.index?.meta?.generatedAt;
    const chamberCount = new Set(entries.map((entry) => toChamber(entry))).size;

    statsEntries.textContent = String(entries.length);
    statsLinks.textContent = String(crossLinks.length);
    statsChambers.textContent = String(chamberCount);
    statsGenerated.textContent = formatDate(generatedAt);
  }

  function renderChamberButtons(entries) {
    const counts = getChamberCounts(entries);
    const chambers = ["all", ...new Set([...counts.keys()].sort((a, b) => a.localeCompare(b)))];

    chamberButtonsRoot.innerHTML = chambers
      .map((chamber) => {
        const count = chamber === "all" ? entries.length : (counts.get(chamber) || 0);
        const activeClass = chamber === state.selectedChamber ? " is-active" : "";
        const label = chamber === "all" ? "All Chambers" : chamber;
        return `<button type="button" class="codex-chamber-btn${activeClass}" data-chamber="${escapeHtml(chamber)}">
          <span>${escapeHtml(label)}</span>
          <span class="codex-badge">${count}</span>
        </button>`;
      })
      .join("");

    chamberButtonsRoot.querySelectorAll(".codex-chamber-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedChamber = button.getAttribute("data-chamber") || "all";
        renderExplorer();
      });
    });
  }

  function renderGraphInsights(entries, crossLinks) {
    const degree = new Map();

    for (const edge of crossLinks) {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    }

    const top = [...degree.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, score]) => ({ id, score, entry: entries.find((item) => item.id === id) }));

    if (!top.length) {
      graphInsightRoot.innerHTML = "<li>No graph edges found yet.</li>";
      return;
    }

    graphInsightRoot.innerHTML = top
      .map((node) => `<li><strong>${escapeHtml(node.entry?.title || node.id)}</strong> <span class="codex-muted">(${node.score} links)</span></li>`)
      .join("");
  }

  function renderExplorer() {
    const entries = sortEntries(getEntries());
    const filtered = filterEntries(entries);

    renderChamberButtons(entries);

    resultCount.textContent = `${filtered.length} result${filtered.length === 1 ? "" : "s"}`;

    if (!filtered.length) {
      entryListRoot.innerHTML = '<p class="codex-empty">No artifacts match the current chamber/search filter.</p>';
      return;
    }

    entryListRoot.innerHTML = filtered
      .map((entry) => {
        const pathHref = `/${String(entry.path || "").replace(/^\/+/, "")}`;
        const tags = Array.isArray(entry.tags) ? entry.tags : [];

        return `<article class="codex-entry-card">
          <div class="codex-entry-head">
            <h4 class="codex-entry-title">${escapeHtml(entry.title || entry.id)}</h4>
            <span class="codex-entry-meta">${escapeHtml(entry.type || "artifact")}</span>
          </div>
          <p class="codex-entry-meta">${escapeHtml(entry.id)} · ${escapeHtml(entry.category || "unknown")}</p>
          <a class="codex-entry-path" href="${escapeHtml(pathHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.path || "(no path)")}</a>
          <p class="codex-entry-meta">Updated: ${escapeHtml(formatDate(entry.updatedAt || entry.createdAt))}</p>
          ${tags.length ? `<div class="codex-tag-row">${tags.slice(0, 10).map((tag) => `<span class="codex-tag">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
        </article>`;
      })
      .join("");
  }

  function renderAll() {
    const entries = getEntries();
    const crossLinks = getCrossLinks();

    renderStats(entries, crossLinks);
    renderGraphInsights(entries, crossLinks);
    renderExplorer();
  }

  async function loadCodexIndex() {
    const candidates = ["/codex/index.json", "/codex-index.json"];

    try {
      let payload = null;

      for (const url of candidates) {
        try {
          const response = await fetch(url, { cache: "no-store" });
          if (!response.ok) {
            continue;
          }
          payload = await response.json();
          break;
        } catch (_error) {
          continue;
        }
      }

      if (!payload) {
        throw new Error("No codex index source is reachable.");
      }

      state.index = payload;
      renderAll();
    } catch (error) {
      statsEntries.textContent = "--";
      statsLinks.textContent = "--";
      statsChambers.textContent = "--";
      statsGenerated.textContent = "--";
      graphInsightRoot.innerHTML = `<li>Unable to load codex graph: ${escapeHtml(error.message)}</li>`;
      entryListRoot.innerHTML = `<p class="codex-empty">Codex index is unavailable. Run <code>npm run codex:reindex</code> to regenerate <code>codex/index.json</code> and the web mirror <code>public/codex-index.json</code>.</p>`;
      resultCount.textContent = "0 results";
      chamberButtonsRoot.innerHTML = "";
    }
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.search = searchInput.value || "";
      renderExplorer();
    });
  }

  loadCodexIndex();
})();
