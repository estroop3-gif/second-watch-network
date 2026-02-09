/**
 * Normalize email subject lines.
 * Converts ALL CAPS subjects to sentence case for readability.
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return '';
  const letters = subject.replace(/[^a-zA-Z]/g, '');
  if (letters.length === 0) return subject;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  if (upperCount / letters.length > 0.7 && letters.length > 3) {
    return subject.charAt(0).toUpperCase() + subject.slice(1).toLowerCase();
  }
  return subject;
}
