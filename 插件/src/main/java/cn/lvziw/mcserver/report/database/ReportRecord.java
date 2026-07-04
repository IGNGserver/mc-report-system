package cn.lvziw.mcserver.report.database;

public record ReportRecord(
    String reporterUuid,
    String reporterName,
    String visibility,
    String content
) {
}
