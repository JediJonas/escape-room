// @ts-check

/**
 * Samlar resultaten från testerna i en text som går att kopiera och skicka.
 * @param {{ output: HTMLElement, version: string }} options
 */
export function createReport({ output, version }) {
  /** @type {Map<string, string>} */
  const lines = new Map();

  function buildText() {
    const header = [
      `Testsida ${version}, ${new Date().toLocaleString('sv-SE')}`,
      navigator.userAgent,
      `Skärm ${screen.width}×${screen.height}, säker anslutning: ${window.isSecureContext ? 'ja' : 'nej'}`,
    ];
    const results = [...lines].map(([topic, result]) => `${topic}: ${result}`);
    return [...header, '', ...(results.length > 0 ? results : ['Inga tester körda än.'])].join('\n');
  }

  const render = () => {
    output.textContent = buildText();
  };

  /**
   * @param {string} topic
   * @param {string} result
   */
  function setResult(topic, result) {
    lines.set(topic, result);
    render();
  }

  render();
  return { setResult, getText: buildText };
}

/**
 * Kopierar texten. Går det inte markeras den, så att den kan kopieras för hand.
 * @param {string} text
 * @param {HTMLElement} output elementet som visar texten
 * @returns {Promise<boolean>} om texten kopierades
 */
export async function copyReport(text, output) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const range = document.createRange();
    range.selectNodeContents(output);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    return false;
  }
}
