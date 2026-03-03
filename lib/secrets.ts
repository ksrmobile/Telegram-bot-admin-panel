const SECRET_KEY_REGEX = /(token|secret|key|pass|auth|cookie)/i;

export function maskSecret(key: string, value: string): string {
  if (!SECRET_KEY_REGEX.test(key)) return value;
  if (!value) return value;
  if (value.length <= 4) return "****";
  const visible = value.slice(-4);
  return `****${visible}`;
}

