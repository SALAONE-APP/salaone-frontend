// Diálogos Radix e páginas roteadas não existem no DOM instantaneamente -
// resolve assim que o elemento aparecer (via MutationObserver, não polling),
// ou null depois do timeout. Usado pelo tour do CRM pra nunca deixar o
// reactour tentar medir um elemento que ainda não foi montado.
export function waitForSelector(
  selector: string,
  opts: { timeoutMs?: number } = {},
): Promise<Element | null> {
  const { timeoutMs = 4000 } = opts;
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        cleanup();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    function cleanup() {
      observer.disconnect();
      clearTimeout(timeout);
    }
  });
}
