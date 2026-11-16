// @ts-check

/**
 * Hämtar ett element som måste finnas i sidan.
 * @param {string} id
 * @returns {HTMLElement}
 */
export function getElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elementet #${id} saknas i sidan`);
  return element;
}

/**
 * @param {string} id
 * @returns {HTMLButtonElement}
 */
export function getButton(id) {
  return /** @type {HTMLButtonElement} */ (getElement(id));
}
