const LAST_ROUTE_KEY = "omni-last-route";

export function setLastRoute(routeInfo) {
  localStorage.setItem(LAST_ROUTE_KEY, JSON.stringify(routeInfo || {}));
}

export function getLastRoute() {
  try {
    return JSON.parse(localStorage.getItem(LAST_ROUTE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

export function mountRouterInspector(containerEl) {
  if (!containerEl) return;
  const route = getLastRoute();
  containerEl.innerHTML = `
    <div class="ui-panel">
      <h4>Model Inspector</h4>
      <p><strong>Task:</strong> ${route.task || "n/a"}</p>
      <p><strong>Model:</strong> ${route.model || "n/a"}</p>
      <p><strong>Reason:</strong> ${route.reason || "n/a"}</p>
    </div>
  `;
}
