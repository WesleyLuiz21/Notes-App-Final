import cron from 'node-cron';
import db from '../db/database.js';

export function startCleanupJob() {
  // Run daily at 2am
  cron.schedule('0 2 * * *', () => {
    try {
      const result = db.prepare(`
        DELETE FROM notes
        WHERE deleted_at IS NOT NULL
        AND deleted_at <= datetime('now', '-20 days')
      `).run();
      
      if (result.changes > 0) {
        db.prepare("INSERT INTO audit_log (event) VALUES (?)").run(`auto_deleted:${result.changes}_notes`);
        console.log(`[cleanup] Auto-deleted ${result.changes} archived notes`);
      }
    } catch (err) {
      console.error('[cleanup] Error during auto-delete job:', err.message);
    }
  });
  
  console.log('[cleanup] Auto-delete job scheduled (daily at 2am)');
}
