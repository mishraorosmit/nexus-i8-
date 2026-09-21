import { getDatabase } from '../db/connection.ts';

export interface AdminDashboardMetrics {
  members: {
    total: number;
    active: number;
    inactive: number;
    alumni: number;
  };
  projects: {
    total: number;
  };
  events: {
    total: number;
    upcoming: number;
  };
}

export class AdminDashboardService {
  /**
   * Queries real SQLite database records to build the admin dashboard overview.
   * If tables have no records, exact 0 values are returned.
   * No raw rows, database internals, or secrets are exposed.
   */
  public getDashboardStats(): AdminDashboardMetrics {
    const db = getDatabase();

    // 1. Members aggregated status metrics
    const memberRow = db.prepare(`
      SELECT 
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN UPPER(status) = 'ACTIVE' THEN 1 ELSE 0 END), 0) AS active,
        COALESCE(SUM(CASE WHEN UPPER(status) = 'INACTIVE' THEN 1 ELSE 0 END), 0) AS inactive,
        COALESCE(SUM(CASE WHEN UPPER(status) = 'ALUMNI' THEN 1 ELSE 0 END), 0) AS alumni
      FROM members
    `).get() as { total: number; active: number; inactive: number; alumni: number } | undefined;

    // 2. Projects count
    const projectRow = db.prepare(`
      SELECT COUNT(*) AS total FROM projects
    `).get() as { total: number } | undefined;

    // 3. Events metrics
    const eventRow = db.prepare(`
      SELECT 
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN LOWER(status) IN ('upcoming', 'published') THEN 1 ELSE 0 END), 0) AS upcoming
      FROM events
    `).get() as { total: number; upcoming: number } | undefined;

    return {
      members: {
        total: Number(memberRow?.total || 0),
        active: Number(memberRow?.active || 0),
        inactive: Number(memberRow?.inactive || 0),
        alumni: Number(memberRow?.alumni || 0),
      },
      projects: {
        total: Number(projectRow?.total || 0),
      },
      events: {
        total: Number(eventRow?.total || 0),
        upcoming: Number(eventRow?.upcoming || 0),
      },
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
