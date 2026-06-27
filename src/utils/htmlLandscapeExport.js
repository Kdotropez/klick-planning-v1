export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const LANDSCAPE_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    background: #eef2f7;
    color: #1a1a1a;
  }
  .portrait-blocker {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 99999;
    background: linear-gradient(160deg, #0f766e 0%, #134e4a 100%);
    color: #fff;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    gap: 16px;
  }
  .portrait-blocker .icon {
    font-size: 64px;
    line-height: 1;
    animation: rotate-hint 2s ease-in-out infinite;
  }
  @keyframes rotate-hint {
    0%, 100% { transform: rotate(0deg); }
    50% { transform: rotate(90deg); }
  }
  .portrait-blocker h1 {
    margin: 0;
    font-size: 1.35rem;
    max-width: 320px;
  }
  .portrait-blocker p {
    margin: 0;
    font-size: 0.95rem;
    opacity: 0.92;
    max-width: 340px;
    line-height: 1.45;
  }
  @media screen and (orientation: portrait) {
    .landscape-content { display: none !important; }
    .portrait-blocker { display: flex !important; }
  }
  @media screen and (orientation: landscape) {
    .portrait-blocker { display: none !important; }
    .landscape-content { display: block !important; }
  }
  .landscape-content {
    min-height: 100vh;
    padding: 12px 16px 24px;
  }
  .doc-header {
    background: #fff;
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .doc-header h1 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    color: #0f766e;
  }
  .doc-header .meta {
    font-size: 0.85rem;
    color: #475569;
    line-height: 1.5;
  }
  .schedule-sheet {
    background: #fff;
    border-radius: 10px;
    padding: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    overflow-x: auto;
  }
  .schedule-sheet table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
    font-size: 13px;
  }
  .schedule-sheet th {
    background: #0f766e;
    color: #fff;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
  }
  .schedule-sheet td {
    border-bottom: 1px solid #e2e8f0;
    padding: 7px 10px;
    vertical-align: top;
  }
  .schedule-sheet tr:nth-child(even) td { background: #f8fafc; }
  .schedule-sheet .subtotal td {
    background: #dcfce7 !important;
    font-weight: 700;
    color: #14532d;
  }
  .schedule-sheet .section-title {
    margin: 18px 0 8px;
    font-size: 1rem;
    color: #0f766e;
    border-bottom: 2px solid #99f6e4;
    padding-bottom: 4px;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .toolbar button {
    background: #0f766e;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 14px;
    cursor: pointer;
  }
  @media print {
    .toolbar, .portrait-blocker { display: none !important; }
    .landscape-content { display: block !important; padding: 0; }
    body { background: #fff; }
  }
`;

const ORIENTATION_SCRIPT = `
(function () {
  function refreshOrientation() {
    var portrait = window.innerHeight > window.innerWidth;
    document.documentElement.classList.toggle('is-portrait', portrait);
    document.documentElement.classList.toggle('is-landscape', !portrait);
  }
  window.addEventListener('resize', refreshOrientation);
  window.addEventListener('orientationchange', refreshOrientation);
  refreshOrientation();
  function tryLockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function () {});
    }
  }
  document.addEventListener('click', tryLockLandscape, { once: true });
})();
`;

export const buildLandscapeHtmlDocument = ({ title, bodyHtml, metaLines = [] }) => {
  const safeTitle = escapeHtml(title || 'Planning');
  const metaHtml = metaLines.length
    ? `<div class="meta">${metaLines.map((line) => escapeHtml(line)).join('<br>')}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>${LANDSCAPE_STYLES}</style>
</head>
<body>
  <div class="portrait-blocker" id="portrait-blocker">
    <div class="icon">📱↻</div>
    <h1>Mode paysage requis</h1>
    <p>Pour lire ce planning, tournez votre téléphone en <strong>mode paysage</strong> (horizontal).</p>
  </div>
  <div class="landscape-content">
    <div class="toolbar">
      <button type="button" onclick="window.print()">🖨️ Imprimer</button>
    </div>
    <div class="doc-header">
      <h1>${safeTitle}</h1>
      ${metaHtml}
    </div>
    ${bodyHtml}
  </div>
  <script>${ORIENTATION_SCRIPT}<\/script>
</body>
</html>`;
};

export const openLandscapeHtmlView = (htmlDocument, windowName = 'klick_planning_html') => {
  const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, windowName);
  if (!win) {
    URL.revokeObjectURL(url);
    return { ok: false, reason: 'popup-blocked' };
  }
  win.addEventListener('load', () => {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  });
  return { ok: true, url };
};

export const downloadLandscapeHtmlFile = (htmlDocument, filename) => {
  const safeName = String(filename || 'planning.html').replace(/[^\w.-]+/g, '_');
  const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName.endsWith('.html') ? safeName : `${safeName}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

export const openOrDownloadLandscapeHtml = (htmlDocument, { title, filename, preferDownload = false }) => {
  if (preferDownload) {
    downloadLandscapeHtmlFile(htmlDocument, filename);
    return { ok: true, mode: 'download' };
  }
  const opened = openLandscapeHtmlView(htmlDocument, `klick_${Date.now()}`);
  if (opened.ok) return { ok: true, mode: 'window' };
  downloadLandscapeHtmlFile(htmlDocument, filename);
  return { ok: true, mode: 'download-fallback' };
};
