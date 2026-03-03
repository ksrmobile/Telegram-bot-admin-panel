const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// Rough but effective ANSI escape matcher (CSI + some common sequences)
const ANSI_REGEX =
  /\x1B\[[0-9;?]*[A-Za-z]|[\x1B][@-_][0-?]*[ -/]*[@-~]/g;

export function stripControlChars(input: string): string {
  if (!input) return "";
  return input.replace(CONTROL_CHARS_REGEX, "");
}

export function stripAnsi(input: string): string {
  if (!input) return "";
  return input.replace(ANSI_REGEX, "");
}

export function cleanLogLine(
  input: string,
  options: { stripAnsi?: boolean } = {}
): string {
  let out = input.replace(/\r+/g, "");
  out = stripControlChars(out);
  if (options.stripAnsi) {
    out = stripAnsi(out);
  }
  return out;
}

export function cleanLogText(
  input: string,
  options: { stripAnsi?: boolean } = {}
): string {
  if (!input) return "";
  return input
    .split("\n")
    .map((line) => cleanLogLine(line, options))
    .join("\n");
}

// Minimal "tests" (can be run manually) to validate sanitization.
export function _runLogSanitizeSelfTest() {
  const sample =
    "ok\x01 line \x1B[31mred\x1B[0m\nnext\x00line\r\nlast\x07line";
  const cleaned = cleanLogText(sample, { stripAnsi: true });
  if (cleaned.includes("\x01") || cleaned.includes("\x00") || cleaned.includes("\x07")) {
    throw new Error("Control characters not stripped");
  }
  if (/\x1B\[[0-9;?]*[A-Za-z]/.test(cleaned)) {
    throw new Error("ANSI codes not stripped");
  }
}

