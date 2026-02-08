import React from 'react';

// Minimal, safe markdown renderer.
// - No raw HTML support (prevents XSS)
// - Supports headings, bullet lists, code fences, inline code, bold

type Props = {
  text: string;
  className?: string;
};

type Block =
  | { kind: 'code'; lang?: string; code: string }
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

const parseBlocks = (input: string): Block[] => {
  const text = (input || '').replace(/\r\n/g, '\n');
  const lines = text.split('\n');

  const blocks: Block[] = [];
  let i = 0;

  const flushParagraph = (buf: string[]) => {
    const t = buf.join('\n').trim();
    if (t) blocks.push({ kind: 'paragraph', text: t });
    buf.length = 0;
  };

  const flushList = (items: string[]) => {
    const cleaned = items.map(s => s.trim()).filter(Boolean);
    if (cleaned.length) blocks.push({ kind: 'list', items: cleaned });
    items.length = 0;
  };

  let paragraphBuf: string[] = [];
  let listBuf: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    const fenceMatch = line.match(/^```\s*([^\s]+)?\s*$/);
    if (fenceMatch) {
      flushParagraph(paragraphBuf);
      flushList(listBuf);
      const lang = fenceMatch[1];
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      // Skip closing fence if present
      if (i < lines.length && lines[i].startsWith('```')) i++;
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (hMatch) {
      flushParagraph(paragraphBuf);
      flushList(listBuf);
      const level = hMatch[1].length as 1 | 2 | 3;
      blocks.push({ kind: 'heading', level, text: hMatch[2].trim() });
      i++;
      continue;
    }

    // Markdown table (very small parser): header row + separator row + 1+ data rows.
    const looksLikeTableRow = (s: string) => s.includes('|') && s.trim().startsWith('|') && s.trim().endsWith('|');
    const isSeparatorRow = (s: string) => {
      const t = s.trim();
      if (!looksLikeTableRow(t)) return false;
      // allow: | --- | :--- | ---: |
      return /^[\|\s:\-]+$/.test(t) && t.includes('-');
    };
    if (looksLikeTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      flushParagraph(paragraphBuf);
      flushList(listBuf);

      const splitRow = (row: string) =>
        row
          .trim()
          .slice(1, -1)
          .split('|')
          .map(c => c.trim());

      const headers = splitRow(line);
      i += 2; // skip header + separator
      const rows: string[][] = [];
      while (i < lines.length && looksLikeTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ kind: 'table', headers, rows });
      continue;
    }

    // List item
    const liMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (liMatch) {
      flushParagraph(paragraphBuf);
      listBuf.push(liMatch[1]);
      i++;
      // Keep collecting consecutive list items
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-*]\s+(.*)$/);
        if (!m) break;
        listBuf.push(m[1]);
        i++;
      }
      flushList(listBuf);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushParagraph(paragraphBuf);
      flushList(listBuf);
      i++;
      continue;
    }

    paragraphBuf.push(line);
    i++;
  }

  flushParagraph(paragraphBuf);
  flushList(listBuf);
  return blocks;
};

const renderInlines = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length) {
    const codeIdx = rest.indexOf('`');
    const boldIdx = rest.indexOf('**');

    const next = [
      { kind: 'code' as const, idx: codeIdx },
      { kind: 'bold' as const, idx: boldIdx },
    ].filter(x => x.idx !== -1).sort((a, b) => a.idx - b.idx)[0];

    if (!next) {
      parts.push(rest);
      break;
    }

    if (next.idx > 0) {
      parts.push(rest.slice(0, next.idx));
      rest = rest.slice(next.idx);
    }

    if (next.kind === 'code') {
      const end = rest.indexOf('`', 1);
      if (end === -1) {
        parts.push(rest);
        break;
      }
      const code = rest.slice(1, end);
      parts.push(
        <code
          key={`c${key++}`}
          className="px-1.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[0.92em]"
        >
          {code}
        </code>
      );
      rest = rest.slice(end + 1);
      continue;
    }

    if (next.kind === 'bold') {
      const end = rest.indexOf('**', 2);
      if (end === -1) {
        parts.push(rest);
        break;
      }
      const strong = rest.slice(2, end);
      parts.push(
        <strong key={`b${key++}`} className="font-black">
          {strong}
        </strong>
      );
      rest = rest.slice(end + 2);
      continue;
    }
  }

  return parts;
};

const Markdown: React.FC<Props> = ({ text, className }) => {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className={className}>
      {blocks.map((b, idx) => {
        if (b.kind === 'code') {
          return (
            <pre
              key={idx}
              className="p-4 rounded-2xl bg-slate-950 text-slate-100 overflow-x-auto border border-slate-900"
            >
              <code className="font-mono text-xs leading-relaxed">{b.code}</code>
            </pre>
          );
        }

        if (b.kind === 'heading') {
          const cls =
            b.level === 1
              ? 'text-xl font-black'
              : b.level === 2
                ? 'text-lg font-black'
                : 'text-base font-black';
          return (
            <div key={idx} className={`${cls} text-slate-900 dark:text-white mt-2`}>
              {renderInlines(b.text)}
            </div>
          );
        }

        if (b.kind === 'list') {
          return (
            <ul key={idx} className="list-disc pl-5 space-y-2 text-slate-700 dark:text-slate-200">
              {b.items.map((it, i) => (
                <li key={i} className="text-[15px] leading-relaxed">
                  {renderInlines(it)}
                </li>
              ))}
            </ul>
          );
        }

        if (b.kind === 'table') {
          const headers = b.headers;
          const rows = b.rows;
          return (
            <div key={idx} className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl">
              <table className="min-w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-900">
                  <tr>
                    {headers.map((h, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700"
                      >
                        {renderInlines(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                  {rows.map((r, ri) => (
                    <tr key={ri} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                      {headers.map((_, ci) => (
                        <td key={ci} className="px-4 py-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                          {renderInlines(r[ci] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
            {renderInlines(b.text)}
          </p>
        );
      })}
    </div>
  );
};

export default Markdown;
