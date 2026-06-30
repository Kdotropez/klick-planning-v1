/** Logs réservés au mode développement (silencieux en build prod). */
export const devLog = (...args) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};
