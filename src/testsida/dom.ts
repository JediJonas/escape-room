/**
 * Hämtar ett element som måste finnas i sidan.
 */
export function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Elementet #${id} saknas i sidan`);
  return element;
}

export function getButton(id: string): HTMLButtonElement {
  return getElement(id) as HTMLButtonElement;
}
