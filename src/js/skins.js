// Helper for generating pixel-perfect Minecraft head avatars (from raw skins or fallback APIs)
const DEFAULT_SKIN_SVG = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCA4IDgnIHNoYXBlLXJlbmRlcmluZz0nY3Jpc3BFZGdlcyc+PHJlY3QgeD0nMCcgeT0nMCcgd2lkdGg9JzgnIGhlaWdodD0nMycgZmlsbD0nJTIzNDUyYjE0Jy8+PHJlY3QgeD0nMCcgeT0nMicgd2lkdGg9JzEnIGhlaWdodD0nMicgZmlsbD0nJTIzNDUyYjE0Jy8+PHJlY3QgeD0nNycgeT0nMicgd2lkdGg9JzEnIGhlaWdodD0nMicgZmlsbD0nJTIzNDUyYjE0Jy8+PHJlY3QgeD0nMScgeT0nMicgd2lkdGg9JzYnIGhlaWdodD0nNScgZmlsbD0nJTIzZGNiMDg1Jy8+PHJlY3QgeD0nMCcgeT0nNCcgd2lkdGg9JzgnIGhlaWdodD0nNCcgZmlsbD0nJTIzZGNiMDg1Jy8+PHJlY3QgeD0nMScgeT0nNCcgd2lkdGg9JzInIGhlaWdodD0nMScgZmlsbD0nJTIzZmZmZmZmJy8+PHJlY3QgeD0nMicgeT0nNCcgd2lkdGg9JzEnIGhlaWdodD0nMScgZmlsbD0nJTIzM2E0NjliJy8+PHJlY3QgeD0nNScgeT0nNCcgd2lkdGg9JzInIGhlaWdodD0nMScgZmlsbD0nJTIzZmZmZmZmJy8+PHJlY3QgeD0nNScgeT0nNCcgd2lkdGg9JzEnIGhlaWdodD0nMScgZmlsbD0nJTIzM2E0NjliJy8+PHJlY3QgeD0nMycgeT0nNScgd2lkdGg9JzInIGhlaWdodD0nMScgZmlsbD0nJTIzYmY4OTYzJy8+PHJlY3QgeD0nMicgeT0nNicgd2lkdGg9JzQnIGhlaWdodD0nMScgZmlsbD0nJTIzNTYzNDFhJy8+PHJlY3QgeD0nMycgeT0nNicgd2lkdGg9JzInIGhlaWdodD0nMScgZmlsbD0nJTIzN2I0YjI3Jy8+PC9zdmc+';

/**
 * Returns HTML string representing a pixel-perfect Minecraft head.
 * If a raw skin texture URL is provided, it extracts the 8x8 head face + 8x8 outer hat layer via CSS sprite.
 * If no skin URL is provided, it falls back to mc-heads.net / DEFAULT_SKIN_SVG.
 */
function getHeadHtml(skinUrl, accountName, size = 26) {
  const safeName = (accountName || 'Player').replace(/"/g, '&quot;');
  
  if (skinUrl && (skinUrl.startsWith('http://') || skinUrl.startsWith('https://') || skinUrl.startsWith('data:'))) {
    let cleanUrl = skinUrl;
    if (cleanUrl.startsWith('http://skinsystem.ely.by/')) {
      cleanUrl = cleanUrl.replace('http://', 'https://');
    }
    const safeUrl = cleanUrl.replace(/'/g, "\\'");
    return `
      <div class="mc-head-avatar" style="width: ${size}px; height: ${size}px;" title="${safeName}">
        <div class="mc-head-face" style="background-image: url('${safeUrl}');"></div>
        <div class="mc-head-hat" style="background-image: url('${safeUrl}');"></div>
      </div>
    `;
  }

  const fallbackUrl = accountName ? `https://mc-heads.net/avatar/${encodeURIComponent(accountName)}/${size}` : DEFAULT_SKIN_SVG;
  return `
    <div class="mc-head-avatar" style="width: ${size}px; height: ${size}px;" title="${safeName}">
      <img src="${fallbackUrl}" class="mc-head-img-fallback" onerror="this.src='${DEFAULT_SKIN_SVG}'" style="width: 100%; height: 100%; image-rendering: pixelated; display: block;">
    </div>
  `;
}

function updateElementAvatar(containerEl, skinUrl, accountName, size = 32) {
  if (!containerEl) return;
  containerEl.innerHTML = getHeadHtml(skinUrl, accountName, size);
}

window.LauncherSkin = {
  DEFAULT_SKIN_SVG,
  getHeadHtml,
  updateElementAvatar
};
