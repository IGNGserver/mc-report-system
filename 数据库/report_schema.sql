CREATE TABLE IF NOT EXISTS reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(120) NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    visibility ENUM('admin', 'superadmin') NOT NULL DEFAULT 'admin',
    status ENUM('pending', 'resolved') NOT NULL DEFAULT 'pending',
    reporter_uuid VARCHAR(36) NOT NULL,
    reporter_name VARCHAR(32) NOT NULL,
    handled_by_user_id BIGINT UNSIGNED NULL,
    handled_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reports_status_visibility_created (status, visibility, created_at),
    KEY idx_reports_reporter_name (reporter_name),
    KEY idx_reports_title (title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
