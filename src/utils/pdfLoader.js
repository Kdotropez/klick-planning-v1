let jsPdfPromise = null;
let html2canvasPromise = null;

/** Charge jsPDF + jspdf-autotable (side-effect) à la demande. */
export async function loadJsPdf() {
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf-autotable').then(() =>
      import('jspdf').then((module) => module.default || module)
    );
  }
  return jsPdfPromise;
}

export async function loadHtml2Canvas() {
  if (!html2canvasPromise) {
    html2canvasPromise = import('html2canvas').then((module) => module.default || module);
  }
  return html2canvasPromise;
}
