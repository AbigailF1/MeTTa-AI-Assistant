import { snippetCompletion, type Completion } from "@codemirror/autocomplete";
import rawStdlib from "./metta-stdlib.json";

export type StdlibParam = {
  name?: string;
  type?: string;
  description?: string;
};

export type StdlibReturns = {
  type?: string;
  description?: string;
};

export type StdlibExample = {
  expr?: string;
  eval?: string;
  result?: string;
};

export type StdlibOverload = {
  type?: string;
  signature?: string;
  params?: StdlibParam[];
  returns?: StdlibReturns;
  description?: string;
  source?: string;
};

export type StdlibEntry = {
  common?: boolean;
  via_import?: boolean;
  kind?: string;
  summary?: string;
  description?: string;
  signatures?: string[];
  params?: StdlibParam[];
  returns?: StdlibReturns;
  types?: string[];
  examples?: StdlibExample[];
  errors?: string[];
  source?: string;
  overloads?: StdlibOverload[];
};

export type StdlibJson = {
  schemaVersion: number;
  builtins: Record<string, StdlibEntry>;
};

const stdlib = rawStdlib as StdlibJson;

const BASE_TYPES = [
  "Atom",
  "Expression",
  "Symbol",
  "Variable",
  "Number",
  "Bool",
  "String",
  "Type",
];

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function formatParamName(param: StdlibParam, index: number): string {
  const raw = (param.name || "").trim();
  if (raw && !/^\$\d+$/.test(raw)) {
    return raw.replace(/^\$/, "");
  }

  const type = (param.type || "").trim();
  if (type && /^[A-Za-z][A-Za-z0-9-]*$/.test(type)) {
    return type;
  }

  return `arg${index + 1}`;
}

function extractTypeTokens(value?: string): string[] {
  if (!value) return [];
  return value.match(/\$[A-Za-z][A-Za-z0-9-]*|%[A-Za-z][A-Za-z0-9-]*%|[A-Z][A-Za-z0-9-]*/g) ?? [];
}

function buildInfoText(label: string, entry: StdlibEntry): string {
  const lines: string[] = [];

  if (entry.signatures?.length) {
    lines.push(entry.signatures[0]);
  }

  if (entry.summary) {
    lines.push(entry.summary);
  } else if (entry.description) {
    lines.push(entry.description);
  }

  if (entry.params?.length) {
    lines.push("");
    lines.push("Parameters:");
    entry.params.forEach((param, index) => {
      const name = param.name || `$${index + 1}`;
      const type = param.type ? `: ${param.type}` : "";
      const desc = param.description ? ` — ${param.description}` : "";
      lines.push(`- ${name}${type}${desc}`);
    });
  }

  if (entry.returns?.type || entry.returns?.description) {
    lines.push("");
    lines.push(
      `Returns: ${entry.returns?.type || "Unknown"}${
        entry.returns?.description ? ` — ${entry.returns.description}` : ""
      }`
    );
  }

  if (entry.examples?.length) {
    const ex = entry.examples[0];
    const preview = ex.eval || ex.expr || ex.result;
    if (preview) {
      lines.push("");
      lines.push(`Example: ${preview}`);
    }
  }

  return lines.join("\n");
}

export function getStdlib(): StdlibJson {
  return stdlib;
}

export function getBuiltinEntry(name: string): StdlibEntry | undefined {
  return stdlib.builtins[name];
}

export function getBuiltinNames(options?: {
  commonOnly?: boolean;
  includeImported?: boolean;
}): string[] {
  const { commonOnly = false, includeImported = false } = options || {};

  return uniqueSorted(
    Object.entries(stdlib.builtins)
      .filter(([_, entry]) => {
        if (!includeImported && entry.via_import) return false;
        if (commonOnly && !entry.common) return false;
        return true;
      })
      .map(([name]) => name)
  );
}

export function getBuiltinNameSet(options?: {
  commonOnly?: boolean;
  includeImported?: boolean;
}): Set<string> {
  return new Set(getBuiltinNames(options));
}

export function getKnownTypes(): string[] {
  const types = new Set<string>(BASE_TYPES);

  for (const entry of Object.values(stdlib.builtins)) {
    entry.params?.forEach((param) => {
      extractTypeTokens(param.type).forEach((token) => types.add(token));
    });

    extractTypeTokens(entry.returns?.type).forEach((token) => types.add(token));

    entry.types?.forEach((typeSig) => {
      extractTypeTokens(typeSig).forEach((token) => types.add(token));
    });

    entry.signatures?.forEach((signature) => {
      extractTypeTokens(signature).forEach((token) => types.add(token));
    });
  }

  return uniqueSorted(types);
}

export function getTypeCompletionOptions(): Completion[] {
  return getKnownTypes().map((label) => ({
    label,
    type: "type",
  }));
}

export function makeBuiltinSnippet(name: string, entry: StdlibEntry): string {
  const params = entry.params ?? [];
  const placeholders = params.map(
    (param, index) => `\${${index + 1}:${formatParamName(param, index)}}`
  );

  return `(${name}${placeholders.length ? " " + placeholders.join(" ") : ""})`;
}

export function getBuiltinCompletionOptions(options?: {
  commonOnly?: boolean;
  includeImported?: boolean;
  asSnippets?: boolean;
}): Completion[] {
  const {
    commonOnly = false,
    includeImported = false,
    asSnippets = true,
  } = options || {};

  return Object.entries(stdlib.builtins)
    .filter(([_, entry]) => {
      if (!includeImported && entry.via_import) return false;
      if (commonOnly && !entry.common) return false;
      return true;
    })
    .map(([label, entry]) => {
      const completionBase: Completion = {
        label,
        type: entry.kind === "function" ? "function" : "variable",
        detail: entry.signatures?.[0] || entry.summary || "",
        info: buildInfoText(label, entry),
        boost: entry.common ? 100 : 0,
      };

      if (!asSnippets) {
        return completionBase;
      }

      return snippetCompletion(makeBuiltinSnippet(label, entry), completionBase);
    });
}

export function getBuiltinDocMap(options?: {
  includeImported?: boolean;
}): Record<string, StdlibEntry> {
  const { includeImported = false } = options || {};
  const result: Record<string, StdlibEntry> = {};

  for (const [name, entry] of Object.entries(stdlib.builtins)) {
    if (!includeImported && entry.via_import) continue;
    result[name] = entry;
  }

  return result;
}