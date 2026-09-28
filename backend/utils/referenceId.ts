import { getDatabase } from '../db/connection.ts';

export type ReferencePrefix = 'APP' | 'INQ' | 'REG';

/**
 * Generates a collision-resistant, human-readable, sequential reference ID:
 * e.g., APP-2026-001, INQ-2026-001, REG-2026-001.
 * 
 * Rules:
 * - Server generated
 * - Stable, unique, never reused
 * - Scoped per year and workflow prefix
 */
export function generateReferenceId(prefix: ReferencePrefix, year: number = new Date().getFullYear()): string {
  const db = getDatabase();
  const yearPrefix = `${prefix}-${year}-`;

  let maxNum = 0;

  if (prefix === 'APP') {
    const row = db.prepare(`
      SELECT reference_id FROM recruitment_submissions 
      WHERE reference_id LIKE ? 
      ORDER BY LENGTH(reference_id) DESC, reference_id DESC 
      LIMIT 1
    `).get(`${yearPrefix}%`) as { reference_id: string } | undefined;

    if (row && row.reference_id) {
      const parts = row.reference_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart)) {
        maxNum = numPart;
      }
    }
  } else if (prefix === 'INQ') {
    const row = db.prepare(`
      SELECT reference_id FROM submissions 
      WHERE reference_id LIKE ? 
      ORDER BY LENGTH(reference_id) DESC, reference_id DESC 
      LIMIT 1
    `).get(`${yearPrefix}%`) as { reference_id: string } | undefined;

    if (row && row.reference_id) {
      const parts = row.reference_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart)) {
        maxNum = numPart;
      }
    }
  } else if (prefix === 'REG') {
    const row = db.prepare(`
      SELECT reference_id FROM event_registrations 
      WHERE reference_id LIKE ? 
      ORDER BY LENGTH(reference_id) DESC, reference_id DESC 
      LIMIT 1
    `).get(`${yearPrefix}%`) as { reference_id: string } | undefined;

    if (row && row.reference_id) {
      const parts = row.reference_id.split('-');
      const numPart = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(numPart)) {
        maxNum = numPart;
      }
    }
  }

  const nextNum = (maxNum + 1).toString().padStart(3, '0');
  return `${yearPrefix}${nextNum}`;
}
