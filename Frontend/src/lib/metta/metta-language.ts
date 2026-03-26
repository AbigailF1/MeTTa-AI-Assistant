import { StreamLanguage, LanguageSupport } from "@codemirror/language";
import { getBuiltinNameSet, getKnownTypes } from "./stdlib";

const CORE_KEYWORDS = new Set([
  "match",
  "if",
  "quote",
  "let",
  "and",
  "or",
  "not",
  "superpose",
  "collapse",
  "import!",
  "bind!",
]);

const DOC_ATOMS = new Set([
  "@doc",
  "@desc",
  "@param",
  "@return",
  "@type",
]);

const OPERATORS = new Set([
  ":",
  "=",
  "->",
  "=>",
  "!",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
]);

const BUILTIN_NAMES = getBuiltinNameSet({
  commonOnly: false,
  includeImported: false,
});

const TYPE_NAMES = new Set(getKnownTypes());

function readWhile(stream: any, re: RegExp) {
  while (!stream.eol() && re.test(stream.peek())) {
    stream.next();
  }
}

const mettaStream = StreamLanguage.define({
  startState() {
    return { inString: false, escaped: false };
  },

  token(stream: any, state: { inString: boolean; escaped: boolean }) {
    if (state.inString) {
      while (!stream.eol()) {
        const ch = stream.next();
        if (state.escaped) {
          state.escaped = false;
        } else if (ch === "\\") {
          state.escaped = true;
        } else if (ch === '"') {
          state.inString = false;
          break;
        }
      }
      return "string";
    }

    if (stream.sol() && stream.peek() === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.peek() === ";") {
      stream.skipToEnd();
      return "comment";
    }

    if (stream.match(/\s+/)) {
      return null;
    }

    const ch = stream.peek();

    if (ch === "(" || ch === ")") {
      stream.next();
      return "bracket";
    }

    if (ch === '"') {
      state.inString = true;
      stream.next();
      return "string";
    }

    if (ch === "$") {
      stream.next();
      readWhile(stream, /[A-Za-z0-9_!?-]/);
      return "variableName";
    }

    if (ch === "&") {
      stream.next();
      readWhile(stream, /[A-Za-z0-9_!?-]/);
      return "namespace";
    }

    if (stream.match(/-?\d+(?:\.\d+)?\b/)) {
      return "number";
    }

    if (stream.match(/(?:->|=>|!=|>=|<=|=|:|!|>|<)/)) {
      return "operator";
    }

    // %Undefined%, %Type%, etc.
    if (stream.match(/%[A-Za-z][A-Za-z0-9-]*%/)) {
      return "typeName";
    }

    // @doc, @param, @return, etc.
    if (stream.match(/@[A-Za-z][A-Za-z0-9-]*/)) {
      const value = stream.current();
      if (DOC_ATOMS.has(value)) return "keyword";
      return "atom";
    }

    if (stream.match(/[A-Za-z_+*\/][A-Za-z0-9_!?+*\/@:%.-]*/)) {
      const value = stream.current();

      if (CORE_KEYWORDS.has(value)) return "keyword";
      if (DOC_ATOMS.has(value)) return "keyword";
      if (TYPE_NAMES.has(value)) return "typeName";
      if (OPERATORS.has(value)) return "operator";
      if (value === "True" || value === "False") return "bool";

      // stdlib functions get their own visual category
      if (BUILTIN_NAMES.has(value)) return "propertyName";

      return "atom";
    }

    stream.next();
    return null;
  },
});

export function mettaLanguage() {
  return new LanguageSupport(mettaStream);
}