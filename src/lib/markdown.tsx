import { ReactNode } from 'react';

/**
 * Minimal Markdown renderer for AI-written article bodies.
 *
 * Deliberately not a Markdown library and deliberately not `dangerouslySetInnerHTML`:
 * the body is model-generated text, so it is rendered as React elements and never as
 * HTML. Even if a prompt injection got a <script> tag into an article, it would render
 * as literal text rather than execute.
 *
 * Supports what the article prompt actually asks for: ## / ### headings, paragraphs,
 * bullet lists, fenced code, and inline `code`, **bold**, and [links](url).
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // One pass over bold, inline code, and links.
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        // Only http(s) — never let a model-authored javascript: URL through.
        const safe = /^https?:\/\//i.test(href) ? href : '#';
        nodes.push(
          <a
            key={key}
            href={safe}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            {label}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(
      <p key={key} className="leading-relaxed text-muted-foreground">
        {renderInline(paragraph.join(' '), key)}
      </p>
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key} className="list-disc space-y-2 pl-6 text-muted-foreground">
        {list.map((item, i) => (
          <li key={`${key}-${i}`} className="leading-relaxed">
            {renderInline(item, `${key}-${i}`)}
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (code === null) {
        flushParagraph();
        flushList();
        code = [];
      } else {
        blocks.push(
          <pre
            key={`code-${blocks.length}`}
            className="overflow-x-auto rounded-xl border bg-muted/50 p-4 text-sm"
          >
            <code className="font-mono">{code.join('\n')}</code>
          </pre>
        );
        code = null;
      }
      continue;
    }

    if (code !== null) {
      code.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      flushList();
    } else if (trimmed.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="pt-2 text-xl font-semibold">
          {trimmed.slice(4)}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="pt-4 text-2xl font-semibold">
          {trimmed.slice(3)}
        </h2>
      );
    } else if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      list.push(trimmed.replace(/^[-*]\s+/, ''));
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }

  flushParagraph();
  flushList();

  return <div className="space-y-4">{blocks}</div>;
}

export default Markdown;
