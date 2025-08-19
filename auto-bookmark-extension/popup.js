const ENABLED_DEFAULT = true;

async function getEnabled() {
  const { enabled = ENABLED_DEFAULT } = await chrome.storage.sync.get({ enabled: ENABLED_DEFAULT });
  return Boolean(enabled);
}

async function setEnabled(val) {
  await chrome.storage.sync.set({ enabled: Boolean(val) });
}

async function getFolderTitle() {
  const key = 'bookmarkFolderId';
  const stored = await chrome.storage.sync.get({ [key]: null });
  const id = stored[key];
  if (!id) return '';
  try {
    const nodes = await chrome.bookmarks.get(id);
    if (Array.isArray(nodes) && nodes[0] && !nodes[0].url) return nodes[0].title;
  } catch (_e) {}
  return '';
}

document.addEventListener('DOMContentLoaded', async () => {
  const enabledEl = document.getElementById('enabled');
  const folderEl = document.getElementById('folder');

  enabledEl.checked = await getEnabled();
  enabledEl.addEventListener('change', async (e) => {
    await setEnabled(e.target.checked);
  });

  const folderTitle = await getFolderTitle();
  folderEl.textContent = folderTitle ? `Saving to: ${folderTitle}` : '';
});
