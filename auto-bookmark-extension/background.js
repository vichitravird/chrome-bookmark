const DEFAULT_STATE = { enabled: true };

async function getEnabledFlag() {
  const stored = await chrome.storage.sync.get(DEFAULT_STATE);
  return Boolean(stored.enabled);
}

async function setEnabledFlag(enabled) {
  await chrome.storage.sync.set({ enabled: Boolean(enabled) });
}

async function ensureFolderExists() {
  const key = 'bookmarkFolderId';
  const stored = await chrome.storage.sync.get({ [key]: null });

  async function folderExists(folderId) {
    if (!folderId) return false;
    try {
      const nodes = await chrome.bookmarks.get(folderId);
      return Array.isArray(nodes) && nodes.length > 0 && !nodes[0].url;
    } catch (_err) {
      return false;
    }
  }

  if (await folderExists(stored[key])) {
    return stored[key];
  }

  const FOLDER_TITLE = 'Clicked Links';
  const searchResults = await chrome.bookmarks.search(FOLDER_TITLE);
  const existingFolder = (searchResults || []).find((n) => !n.url && n.title === FOLDER_TITLE);
  if (existingFolder) {
    await chrome.storage.sync.set({ [key]: existingFolder.id });
    return existingFolder.id;
  }

  let parentId = '1'; // Bookmarks Bar
  try {
    await chrome.bookmarks.get(parentId);
  } catch (_e1) {
    parentId = '2'; // Other Bookmarks fallback
  }

  const created = await chrome.bookmarks.create({ parentId, title: FOLDER_TITLE });
  await chrome.storage.sync.set({ [key]: created.id });
  return created.id;
}

async function upsertBookmark(url, title) {
  if (!url || !(url.startsWith('http://') || url.startsWith('https://'))) return;

  const results = await chrome.bookmarks.search(url);
  const alreadyExists = (results || []).some((n) => n.url === url);
  if (alreadyExists) return;

  const folderId = await ensureFolderExists();
  const bookmarkTitle = title && title.trim() ? title.trim().slice(0, 255) : url;
  await chrome.bookmarks.create({ parentId: folderId, title: bookmarkTitle, url });
}

chrome.runtime.onInstalled.addListener(async () => {
  await ensureFolderExists();
  const stored = await chrome.storage.sync.get(DEFAULT_STATE);
  if (typeof stored.enabled === 'undefined') {
    await setEnabledFlag(DEFAULT_STATE.enabled);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (!message || message.type !== 'link-clicked') return;
  (async () => {
    const enabled = await getEnabledFlag();
    if (!enabled) return;
    const { url, title } = message;
    await upsertBookmark(String(url || ''), String(title || ''));
  })().catch(() => {});
});
