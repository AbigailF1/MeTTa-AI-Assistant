import { StreamLanguage, LanguageSupport, StringStream } from "@codemirror/language";
import { getBuiltinNameSet, getKnownTypes } from "./stdlib";

const CORE_WORDS = new Set([
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

const DOC_WORDS = new Set([
  "@doc",
  "@desc",
  "@param",
  "@params",
  "@return",
  "@type",
  "@item",
  "@kind",
]);

const BUILTIN_NAMES = getBuiltinNameSet();
const TYPE_NAMES = new Set(getKnownTypes());

function readWhile(stream: StringStream, re: RegExp) {
  while (!stream.eol()) {
    const next = stream.peek();
    if (next === undefined || !re.test(next)) break;
    stream.next();
  }
}

const mettaStream = StreamLanguage.define({
  startState() {
    return { inString: false, escaped: false };
  },

  token(stream: StringStream, state: { inString: boolean; escaped: boolean }) {
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

    if (stream.match(/%[A-Za-z][A-Za-z0-9-]*%/)) {
      return "keyword";
    }

    if (stream.match(/@[A-Za-z][A-Za-z0-9-]*/)) {
      const value = stream.current();
      if (DOC_WORDS.has(value)) return "keyword";
      return "atom";
    }

    if (stream.match(/[A-Za-z_+*\/][A-Za-z0-9_!?+*\/@:%.-]*/)) {
      const value = stream.current();

      if (CORE_WORDS.has(value)) return "keyword";
      if (DOC_WORDS.has(value)) return "keyword";
      if (TYPE_NAMES.has(value)) return "keyword";
      if (BUILTIN_NAMES.has(value)) return "keyword";
      if (value === "True" || value === "False") return "keyword";

      return "atom";
    }

    stream.next();
    return null;
  },
});

export function mettaLanguage() {
  return new LanguageSupport(mettaStream);
}