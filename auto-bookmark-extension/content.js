(() => {
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
