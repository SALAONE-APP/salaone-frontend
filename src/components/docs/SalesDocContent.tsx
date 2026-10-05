import { useMemo } from "react";

import "./doc-content.css";

interface Heading {
  id: string;
  text: string;
  level: number;
}

// Poe id nos titulos (para o indice e links ancora) e devolve a lista deles.
// O HTML ja chega sanitizado do backend; o DOMParser nao executa nada.
function prepare(html: string): { html: string; headings: Heading[] } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const headings: Heading[] = [];
  doc.body.querySelectorAll("h1, h2, h3").forEach((element, index) => {
    const text = element.textContent?.trim() ?? "";
    if (!text) return;
    const id = `secao-${index + 1}`;
    element.id = id;
    headings.push({ id, text, level: Number(element.tagName.slice(1)) });
  });
  return { html: doc.body.innerHTML, headings };
}

export function SalesDocContent({ html }: { html: string }) {
  const { html: content, headings } = useMemo(() => prepare(html), [html]);

  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">Este documento ainda está vazio.</p>;
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      {headings.length > 1 && (
        <nav aria-label="Neste documento" className="shrink-0 lg:order-2 lg:sticky lg:top-20 lg:w-56">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Neste documento</p>
          <ul className="space-y-1 border-l border-border">
            {headings.map((heading) => (
              <li key={heading.id} style={{ paddingLeft: `${0.75 + (heading.level - 1) * 0.75}rem` }}>
                <a href={`#${heading.id}`} className="block text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {heading.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <article className="doc-content doc-readonly min-w-0 flex-1 lg:order-1 max-w-3xl" dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}
