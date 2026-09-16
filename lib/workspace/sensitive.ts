import { basename } from "./path";

const SENSITIVE_NAMES = new Set([
  ".env",
  "credentials",
  "credentials.json",
  "id_rsa",
  "id_ed25519",
  "id_dsa",
  "id_ecdsa",
]);

const SENSITIVE_PATTERNS = [
  /^\.env\./,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /id_rsa/,
  /id_ed25519/,
  /secrets?/i,
];

export function isSensitivePath(path: string): boolean {
  const name = basename(path).toLowerCase();
  if (SENSITIVE_NAMES.has(name) || SENSITIVE_NAMES.has(basename(path))) return true;
  if (name === ".env") return true;
  return SENSITIVE_PATTERNS.some((re) => re.test(name) || re.test(path));
}

export function redactSecrets(text: string): string {
  return text
    .replace(/(api[_-]?key\s*[=:]\s*)(["']?)[^\s"']+/gi, "$1$2[redacted]")
    .replace(/(secret\s*[=:]\s*)(["']?)[^\s"']+/gi, "$1$2[redacted]")
    .replace(/(token\s*[=:]\s*)(["']?)[^\s"']+/gi, "$1$2[redacted]")
    .replace(/sk-or-v1-[a-z0-9]+/gi, "[redacted-openrouter-key]")
    .replace(/ghp_[a-zA-Z0-9]+/g, "[redacted-github-token]")
    .replace(/github_pat_[a-zA-Z0-9_]+/g, "[redacted-github-token]");
}
