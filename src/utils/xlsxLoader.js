let xlsxPromise = null;
let xlsxStyledPromise = null;

export async function loadXlsx() {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx').then((module) => module.default || module);
  }
  return xlsxPromise;
}

export async function loadXlsxStyled() {
  if (!xlsxStyledPromise) {
    xlsxStyledPromise = import('xlsx-js-style').then((module) => module.default || module);
  }
  return xlsxStyledPromise;
}

export async function loadXlsxPair() {
  const [styled, core] = await Promise.all([loadXlsxStyled(), loadXlsx()]);
  return { XLSX: styled, XLSXCore: core };
}
