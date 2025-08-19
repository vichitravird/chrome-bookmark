(() => {
  // Sidebar UI
  const SIDEBAR_ID = 'auto-bookmark-sidebar-root';
  const LOCAL_STATE_KEY = 'sidebarCollapsed';

  let sidebarHost = null;

  function createSidebar() {
    if (sidebarHost && document.contains(sidebarHost)) return sidebarHost;
    const host = document.createElement('div');
    host.id = SIDEBAR_ID;
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.right = '0';
    host.style.height = '100vh';
    host.style.width = '280px';
    host.style.zIndex = '2147483647';
    host.style.pointerEvents = 'auto';
    host.style.display = 'none';

    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.innerHTML = `
      <style>
        :host { all: initial; }
        .panel {
          box-sizing: border-box;
          height: 100vh;
          width: 280px;
          background: #ffffff;
          color: #222;
          border-left: 1px solid #e5e7eb;
          box-shadow: -2px 0 8px rgba(0,0,0,0.08);
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: #f8fafc;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          font-size: 14px;
        }
        .badge {
          background: #10b981;
          color: #fff;
          border-radius: 999px;
          padding: 2px 8px;
          font-weight: 700;
          font-size: 11px;
        }
        .btn {
          appearance: none;
          border: 0;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
          padding: 2px 6px;
        }
        .body { padding: 12px; font-size: 13px; line-height: 1.35; }
        .muted { color: #6b7280; }
      </style>
      <div class="panel" part="panel">
        <div class="header">
          <span>Bookmarks</span>
          <span class="badge">ON</span>
          <button class="btn" id="collapse" title="Hide sidebar">✕</button>
        </div>
        <div class="body">
          <div class="muted">Auto-bookmarking clicked links is enabled.</div>
        </div>
      </div>
    `;
    shadow.appendChild(container);

    // Collapse handler
    const collapseBtn = container.querySelector('#collapse');
    collapseBtn.addEventListener('click', async () => {
      host.style.display = 'none';
      try { await chrome.storage.local.set({ [LOCAL_STATE_KEY]: true }); } catch (_e) {}
    });

    document.documentElement.appendChild(host);
    sidebarHost = host;
    return host;
  }

  async function getEnabledFlag() {
    try {
      const { enabled = true } = await chrome.storage.sync.get({ enabled: true });
      return Boolean(enabled);
    } catch (_e) {
      return true;
    }
  }

  async function getCollapsedFlag() {
    try {
      const stored = await chrome.storage.local.get({ [LOCAL_STATE_KEY]: false });
      return Boolean(stored[LOCAL_STATE_KEY]);
    } catch (_e) {
      return false;
    }
  }

  async function updateSidebarVisibility() {
    const enabled = await getEnabledFlag();
    const collapsed = await getCollapsedFlag();
    if (!enabled) {
      if (sidebarHost) sidebarHost.style.display = 'none';
      return;
    }
    const host = createSidebar();
    host.style.display = collapsed ? 'none' : 'block';
  }

  // React to changes from popup
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes.enabled) {
        // When user enables, un-collapse so it's visible
        if (changes.enabled.newValue === true) {
          chrome.storage.local.set({ [LOCAL_STATE_KEY]: false }).finally(() => {
            updateSidebarVisibility();
          });
        } else {
          updateSidebarVisibility();
        }
      }
      if (area === 'local' && Object.prototype.hasOwnProperty.call(changes, LOCAL_STATE_KEY)) {
        updateSidebarVisibility();
      }
    });
  } catch (_e) {}
  
  // Initialize ASAP
  updateSidebarVisibility();

  function getAnchorFromEvent(event) {
    if (!event) return null;
    const path = (event.composedPath && event.composedPath()) || [];
    for (const node of path) {
      if (node && node.tagName && String(node.tagName).toLowerCase() === 'a') {
        return node;
      }
    }
    let el = event.target;
    while (el && el !== document.body) {
      if (el.tagName && String(el.tagName).toLowerCase() === 'a') return el;
      el = el.parentElement;
    }
    return null;
  }

  const recent = new Map();
  const DEDUPE_MS = 4000;

  function shouldSkip(url) {
    const now = Date.now();
    const last = recent.get(url) || 0;
    recent.set(url, now);
    for (const [u, t] of Array.from(recent.entries())) {
      if (now - t > DEDUPE_MS) recent.delete(u);
    }
    return now - last < DEDUPE_MS;
  }

  function extractTitle(anchor) {
    const text = (anchor && (anchor.innerText || anchor.textContent || '')) || '';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned) return cleaned;
    return document.title || '';
  }

  document.addEventListener(
    'click',
    (event) => {
      // Ignore clicks inside the sidebar
      try {
        const path = (event.composedPath && event.composedPath()) || [];
        if (sidebarHost && (path.includes(sidebarHost) || (sidebarHost.shadowRoot && path.includes(sidebarHost.shadowRoot)))) {
          return;
        }
      } catch (_e) {}
      const anchor = getAnchorFromEvent(event);
      if (!anchor) return;
      const href = anchor.href;
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }
      if (shouldSkip(href)) return;
      const title = extractTitle(anchor);
      try {
        chrome.runtime.sendMessage({ type: 'link-clicked', url: href, title });
      } catch (_err) {
        // ignore messaging errors
      }
    },
    true
  );
})();
