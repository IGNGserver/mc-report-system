package cn.lvziw.mcserver.report.database;

import cn.lvziw.mcserver.report.ReportPlugin;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.bukkit.configuration.file.FileConfiguration;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;

public final class DatabaseManager {
    private final ReportPlugin plugin;
    private HikariDataSource dataSource;

    public DatabaseManager(ReportPlugin plugin) {
        this.plugin = plugin;
    }

    public void initialize() {
        FileConfiguration config = plugin.getConfig();
        String host = config.getString("database.host", "127.0.0.1");
        int port = config.getInt("database.port", 3306);
        String database = config.getString("database.name", "mc_server");
        String username = config.getString("database.username", "root");
        String password = config.getString("database.password", "");
        String parameters = config.getString("database.parameters", "");

        HikariConfig hikariConfig = new HikariConfig();
        hikariConfig.setJdbcUrl("jdbc:mysql://" + host + ":" + port + "/" + database + parameters);
        hikariConfig.setUsername(username);
        hikariConfig.setPassword(password);
        hikariConfig.setMaximumPoolSize(10);
        hikariConfig.setMinimumIdle(2);
        hikariConfig.setPoolName("MCReportPool");

        this.dataSource = new HikariDataSource(hikariConfig);
        ensureSchema();
    }

    private void ensureSchema() {
        String reportsSql = """
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """;

        String targetsSql = """
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
            """;

        try (Connection connection = getConnection(); Statement statement = connection.createStatement()) {
            statement.execute(reportsSql);
            statement.execute(targetsSql);
        } catch (SQLException exception) {
            throw new IllegalStateException("初始化举报数据表失败", exception);
        }
    }

    public void saveReport(ReportRecord report, List<ReportTarget> targets) throws SQLException {
        String reportSql = """
            INSERT INTO reports (title, content, visibility, status, reporter_uuid, reporter_name)
            VALUES ('', ?, ?, 'pending', ?, ?)
            """;
        String targetSql = """
            INSERT INTO report_targets (report_id, target_uuid, target_name)
            VALUES (?, ?, ?)
            """;

        try (Connection connection = getConnection()) {
            connection.setAutoCommit(false);
            try (PreparedStatement reportStatement = connection.prepareStatement(reportSql, Statement.RETURN_GENERATED_KEYS)) {
                reportStatement.setString(1, report.content());
                reportStatement.setString(2, report.visibility());
                reportStatement.setString(3, report.reporterUuid());
                reportStatement.setString(4, report.reporterName());
                reportStatement.executeUpdate();

                long reportId;
                try (var keys = reportStatement.getGeneratedKeys()) {
                    if (!keys.next()) {
                        throw new SQLException("举报写入成功但未返回主键");
                    }
                    reportId = keys.getLong(1);
                }

                try (PreparedStatement targetStatement = connection.prepareStatement(targetSql)) {
                    for (ReportTarget target : targets) {
                        targetStatement.setLong(1, reportId);
                        targetStatement.setString(2, target.targetUuid());
                        targetStatement.setString(3, target.targetName());
                        targetStatement.addBatch();
                    }
                    targetStatement.executeBatch();
                }

                connection.commit();
            } catch (SQLException exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(true);
            }
        }
    }

    private Connection getConnection() throws SQLException {
        if (dataSource == null) {
            throw new SQLException("数据库连接池尚未初始化");
        }
        return dataSource.getConnection();
    }

    public void close() {
        if (dataSource != null) {
            dataSource.close();
        }
    }
}
