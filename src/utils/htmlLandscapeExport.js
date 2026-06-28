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
    padding: 8px 6px 16px;
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
    padding: 8px 6px;
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
  .schedule-sheet.readable-presence .roster-table tr:nth-child(even) td {
    background: #fff;
  }
  .schedule-sheet.readable-presence .planning-grid-export tr:nth-child(even) td,
  .schedule-sheet.readable-presence .planning-grid-export tr:nth-child(odd) td {
    background: unset;
  }
  .schedule-sheet.readable-presence .planning-grid-export .pg-slot-on {
    background: #22c55e !important;
    color: #fff !important;
  }
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
  .schedule-sheet.exported-view table { min-width: 640px; font-size: 11px; }
  .schedule-sheet.exported-view th {
    background: #f0f0f0;
    color: #111;
    border: 1px solid #ddd;
  }
  .schedule-sheet.exported-view td { border: 1px solid #ddd; }
  .schedule-sheet.inspection-sheet .meta-table th {
    width: 22%;
    text-align: left;
    background: #eaf2f8;
    color: #123;
    border: 1px solid #b0bec5;
    padding: 4px 6px;
  }
  .schedule-sheet.inspection-sheet .meta-table td {
    border: 1px solid #b0bec5;
    padding: 4px 6px;
  }
  .schedule-sheet.inspection-sheet .schedule-table {
    font-size: 9px;
    table-layout: fixed;
  }
  .schedule-sheet.inspection-sheet .schedule-table th {
    background: #0f4c81;
    color: #fff;
    border: 1px solid #345;
    padding: 5px 4px;
  }
  .schedule-sheet.inspection-sheet .schedule-table td {
    border: 1px solid #9e9e9e;
    padding: 5px 4px;
    vertical-align: top;
    word-break: break-word;
  }
  .schedule-sheet.inspection-sheet .hours {
    font-weight: bold;
    text-align: center;
    white-space: nowrap;
  }
  .schedule-sheet .footer-note {
    margin-top: 10px;
    font-size: 10px;
    color: #455a64;
  }
  .schedule-sheet.matrix-export table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
    min-width: 900px;
  }
  .schedule-sheet.matrix-export th,
  .schedule-sheet.matrix-export td {
    border: 1px solid #cbd5e1;
    padding: 5px;
    vertical-align: top;
    word-break: break-word;
  }
  .schedule-sheet.matrix-export thead th {
    background: #0f4c75;
    color: #fff;
  }
  .schedule-sheet.matrix-export tbody th {
    background: #e8f0f7;
    color: #12395b;
  }
  .schedule-sheet.matrix-export .matrix-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    margin-bottom: 12px;
  }
  .schedule-sheet.matrix-export .matrix-card {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px;
    background: #f8fafc;
  }
  .schedule-sheet.matrix-export .matrix-card strong {
    display: block;
    font-size: 15px;
    color: #0f4c75;
  }
  .schedule-sheet.matrix-export .matrix-card span {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
  }
  .schedule-sheet.matrix-export .week-block-title {
    font-size: 14px;
    color: #12395b;
    margin: 14px 0 8px;
    font-weight: 700;
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

export const buildLandscapeHtmlDocument = ({ title, bodyHtml, metaLines = [], allowPortrait = false }) => {
  const safeTitle = escapeHtml(title || 'Planning');
  const metaHtml = metaLines.length
    ? `<div class="meta">${metaLines.map((line) => escapeHtml(line)).join('<br>')}</div>`
    : '';
  const portraitBlockerHtml = allowPortrait
    ? ''
    : `<div class="portrait-blocker" id="portrait-blocker">
    <div class="icon">📱↻</div>
    <h1>Mode paysage requis</h1>
    <p>Pour lire ce planning, tournez votre téléphone en <strong>mode paysage</strong> (horizontal).</p>
  </div>`;
  const portraitOkStyles = allowPortrait
    ? `
  .portrait-blocker { display: none !important; }
  @media screen and (orientation: portrait) {
    .landscape-content { display: block !important; }
    .portrait-blocker { display: none !important; }
  }`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${safeTitle}</title>
  <style>${LANDSCAPE_STYLES}${portraitOkStyles}</style>
</head>
<body>
  ${portraitBlockerHtml}
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

export const deliverLandscapeHtmlExport = (htmlDocument, { filename, openPreview = true }) => {
  downloadLandscapeHtmlFile(htmlDocument, filename);
  if (openPreview) {
    openLandscapeHtmlView(htmlDocument, `preview_${Date.now()}`);
  }
  return { ok: true, mode: 'download' };
};

export const openOrDownloadLandscapeHtml = (htmlDocument, { title, filename, preferDownload = true }) => {
  if (preferDownload) {
    return deliverLandscapeHtmlExport(htmlDocument, { filename, openPreview: true });
  }
  const opened = openLandscapeHtmlView(htmlDocument, `klick_${Date.now()}`);
  if (opened.ok) return { ok: true, mode: 'window' };
  return deliverLandscapeHtmlExport(htmlDocument, { filename, openPreview: false });
};

export const LANDSCAPE_MOBILE_HINT =
  'Mode paysage requis sur telephone pour une lecture optimale.';

export const DEFAULT_EXPORT_IGNORE_SELECTORS = [
  '[data-html2canvas-ignore="true"]',
  '.button-group',
  '.button-pdf',
  '.button-retour',
  '.modal-close',
];

export const cloneElementHtmlForExport = (
  sourceElement,
  ignoreSelectors = DEFAULT_EXPORT_IGNORE_SELECTORS
) => {
  if (!sourceElement) return '';
  const clone = sourceElement.cloneNode(true);
  ignoreSelectors.forEach((selector) => {
    clone.querySelectorAll(selector).forEach((element) => element.remove());
  });
  clone.querySelectorAll('button').forEach((element) => element.remove());
  return clone.innerHTML;
};

export const exportElementHtmlAsLandscape = ({
  element,
  title,
  metaLines = [],
  filename,
  sheetClassName = 'exported-view',
}) => {
  if (!element) return { ok: false, reason: 'no-element' };
  const inner = cloneElementHtmlForExport(element);
  const bodyHtml = `<div class="schedule-sheet ${sheetClassName}">${inner}</div>`;
  const doc = buildLandscapeHtmlDocument({
    title,
    bodyHtml,
    metaLines: [...metaLines, LANDSCAPE_MOBILE_HINT],
  });
  return openOrDownloadLandscapeHtml(doc, { title, filename });
};

export const exportModalContentFromButtonAsLandscape = ({
  triggerElement,
  title,
  metaLines = [],
  filename,
}) => {
  const root =
    triggerElement?.closest('.modal-overlay')?.querySelector('.modal-content') ||
    triggerElement?.closest('[data-export-root]')?.querySelector('[data-export-content]') ||
    triggerElement?.closest('[data-export-root]') ||
    document.querySelector('.modal-content');
  return exportElementHtmlAsLandscape({ element: root, title, metaLines, filename });
};

export const exportRawBodyHtmlAsLandscape = ({
  bodyHtml,
  title,
  metaLines = [],
  filename,
  sheetClassName = '',
}) => {
  const wrapped = sheetClassName
    ? `<div class="schedule-sheet ${sheetClassName}">${bodyHtml}</div>`
    : bodyHtml;
  const doc = buildLandscapeHtmlDocument({
    title,
    bodyHtml: wrapped,
    metaLines: [...metaLines, LANDSCAPE_MOBILE_HINT],
  });
  return openOrDownloadLandscapeHtml(doc, { title, filename });
};
