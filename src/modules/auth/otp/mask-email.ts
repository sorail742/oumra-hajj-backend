// Adresse masquée pour les journaux (ADR 0025 §7) : « a***@domaine ».
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) {
    return '***';
  }
  return `${email[0]}***${email.slice(at)}`;
}
