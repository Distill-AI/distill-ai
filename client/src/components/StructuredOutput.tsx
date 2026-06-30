import { useMemo } from 'react';

interface StructuredOutputProps {
  data: Record<string, unknown> | null;
}

function summarizeValue(value: unknown, indent: string): string {
  if (Array.isArray(value)) {
    return `[ ${value.length} item${value.length === 1 ? '' : 's'} ]`;
  }
  if (value === null) return 'null';
  if (typeof value === 'object') return stringifyObject(value as Record<string, unknown>, indent);
  return JSON.stringify(value);
}

function stringifyObject(obj: Record<string, unknown>, indent: string): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  const nextIndent = `${indent}  `;
  const lines = keys.map((key, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    return `${nextIndent}"${key}": ${summarizeValue(obj[key], nextIndent)}${comma}`;
  });
  return `{\n${lines.join('\n')}\n${indent}}`;
}

function stringifyWithArraySummary(data: Record<string, unknown>): string {
  return stringifyObject(data, '');
}

type Token = { type: 'key' | 'string' | 'structure'; text: string };

const KEY_RE = /^(\s*)("[\w_]+")(:)(.*)$/;
const STRING_VALUE_RE = /^("[^"]*")$/;

function tokenizeLine(line: string): Token[] {
  const keyMatch = KEY_RE.exec(line);
  if (keyMatch) {
    const [, indent, key, colon, rest] = keyMatch;
    const tokens: Token[] = [
      { type: 'structure', text: indent },
      { type: 'key', text: key },
      { type: 'structure', text: `${colon} ` },
    ];
    const valuePart = rest.trim().replace(/,$/, '');
    const comma = rest.trim().endsWith(',') ? ',' : '';
    if (STRING_VALUE_RE.test(valuePart)) {
      tokens.push({ type: 'string', text: valuePart });
    } else {
      tokens.push({ type: 'structure', text: valuePart });
    }
    if (comma) tokens.push({ type: 'structure', text: ',' });
    return tokens;
  }
  return [{ type: 'structure', text: line }];
}

const COLOR: Record<Token['type'], string> = {
  key: 'text-accent',
  string: 'text-success-text',
  structure: 'text-body-text',
};

export function StructuredOutput({ data }: StructuredOutputProps) {
  const json = useMemo(() => {
    if (!data) return '';
    try {
      return stringifyWithArraySummary(data);
    } catch {
      return String(data);
    }
  }, [data]);

  if (!data) {
    return (
      <div className="rounded-lg bg-surface p-6 text-center text-sm text-muted">No output</div>
    );
  }

  const lines = json.split('\n');

  return (
    <div className="rounded-md bg-canvas border border-border p-4 overflow-x-auto">
      <pre className="font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i}>
            {tokenizeLine(line).map((tok, j) => (
              <span key={j} className={COLOR[tok.type]}>
                {tok.text}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}
