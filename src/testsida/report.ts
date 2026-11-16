/**
 * Samlar resultaten från testerna i en text som går att kopiera och skicka.
 */
export function createReport({ output, version }: { output: HTMLElement; version: string }) {
  const lines: Map<string, string> = new Map();

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

  function setResult(topic: string, result: string) {
    lines.set(topic, result);
    render();
  }

  render();
  return { setResult, getText: buildText };
}

/**
 * Kopierar texten. Går det inte markeras den, så att den kan kopieras för hand.
 * @param output elementet som visar texten
 * @returns om texten kopierades
 */
/** Skriver en rad i felsökningsloggen. */
export type Log = (text: string) => void;

export type Report = ReturnType<typeof createReport>;

export async function copyReport(text: string, output: HTMLElement): Promise<boolean> {
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
