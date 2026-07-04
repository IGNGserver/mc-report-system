import mysql from "mysql2/promise";

const globalForDb = globalThis;

function createPoolFromEnv(prefix, fallback = {}) {
  return mysql.createPool({
    host: process.env[`${prefix}_HOST`] || fallback.host || "127.0.0.1",
    port: Number(process.env[`${prefix}_PORT`] || fallback.port || "3306"),
    database: process.env[`${prefix}_NAME`] || fallback.database || "mc_report_system",
    user: process.env[`${prefix}_USER`] || fallback.user || "root",
    password: process.env[`${prefix}_PASSWORD`] || fallback.password || "",
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  });
}

export const pool =
  globalForDb.__mcReportPool ||
  createPoolFromEnv("DB", {
    host: "127.0.0.1",
    port: "3306",
    database: "mc_report_system",
    user: "root",
    password: ""
  });

if (!globalForDb.__mcReportPool) {
  globalForDb.__mcReportPool = pool;
}

export const authMePool =
  globalForDb.__mcAuthMePool ||
  createPoolFromEnv("AUTHME_DB", {
    host: process.env.DB_HOST || "127.0.0.1",
    port: process.env.DB_PORT || "3306",
    database: process.env.DB_NAME || "mc_report_system",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || ""
  });

if (!globalForDb.__mcAuthMePool) {
  globalForDb.__mcAuthMePool = authMePool;
}

let schemaPromise;

async function hasColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );

  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (await hasColumn(tableName, columnName)) {
    return;
  }

  await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
}

async function ensureIndex(tableName, indexName, definition) {
  try {
    await pool.query(`CREATE INDEX \`${indexName}\` ON \`${tableName}\` ${definition}`);
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME" && error?.code !== "ER_TOO_LONG_IDENT") {
      throw error;
    }
  }
}

export async function ensureReportSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          title VARCHAR(120) NOT NULL DEFAULT '',
          content TEXT NOT NULL,
          visibility ENUM('admin', 'superadmin') NOT NULL DEFAULT 'admin',
          target_visibility ENUM('private', 'public') NOT NULL DEFAULT 'private',
          status ENUM('pending', 'resolved') NOT NULL DEFAULT 'pending',
          reporter_uuid VARCHAR(64) NOT NULL DEFAULT '',
          reporter_type ENUM('admin', 'player') NOT NULL DEFAULT 'admin',
          reporter_account VARCHAR(64) NOT NULL DEFAULT '',
          reporter_name VARCHAR(32) NOT NULL,
          handled_by_user_id BIGINT UNSIGNED NULL,
          handled_by_type ENUM('admin', 'player') NULL,
          handled_by_account VARCHAR(64) NULL,
          handled_at DATETIME NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_reports_status_visibility_created (status, visibility, created_at),
          KEY idx_reports_reporter_name (reporter_name),
          KEY idx_reports_title (title)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS report_targets (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          report_id BIGINT UNSIGNED NOT NULL,
          target_uuid VARCHAR(36) NULL,
          target_name VARCHAR(32) NOT NULL,
          PRIMARY KEY (id),
          KEY idx_report_targets_report_id (report_id),
          KEY idx_report_targets_target_name (target_name),
          CONSTRAINT fk_report_targets_report
            FOREIGN KEY (report_id) REFERENCES reports(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS report_replies (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          report_id BIGINT UNSIGNED NOT NULL,
          author_type ENUM('admin', 'player') NOT NULL,
          author_account VARCHAR(64) NOT NULL,
          author_name VARCHAR(64) NOT NULL,
          content TEXT NOT NULL,
          deleted_at DATETIME NULL,
          deleted_by_type ENUM('admin', 'player') NULL,
          deleted_by_account VARCHAR(64) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_report_replies_report_id_created (report_id, created_at),
          CONSTRAINT fk_report_replies_report
            FOREIGN KEY (report_id) REFERENCES reports(id)
            ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      await ensureColumn("reports", "target_visibility", "ENUM('private', 'public') NOT NULL DEFAULT 'private' AFTER visibility");
      await ensureColumn("reports", "reporter_type", "ENUM('admin', 'player') NOT NULL DEFAULT 'admin' AFTER reporter_uuid");
      await ensureColumn("reports", "reporter_account", "VARCHAR(64) NOT NULL DEFAULT '' AFTER reporter_type");
      await ensureColumn("reports", "handled_by_type", "ENUM('admin', 'player') NULL AFTER handled_by_user_id");
      await ensureColumn("reports", "handled_by_account", "VARCHAR(64) NULL AFTER handled_by_type");

      await pool.query(`
        UPDATE reports
        SET reporter_type = 'admin'
        WHERE reporter_type IS NULL OR reporter_type = ''
      `);

      await pool.query(`
        UPDATE reports
        SET reporter_account = LOWER(COALESCE(NULLIF(reporter_account, ''), reporter_name))
        WHERE reporter_account IS NULL OR reporter_account = ''
      `);

      await ensureIndex(
        "reports",
        "idx_reports_reporter_owner",
        "(reporter_type, reporter_account, created_at)"
      );
      await ensureIndex(
        "reports",
        "idx_reports_target_visibility",
        "(target_visibility, created_at)"
      );
    })();
  }

  await schemaPromise;
}
