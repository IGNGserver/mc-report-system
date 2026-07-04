import { notFound } from "next/navigation";
import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { getReportById } from "@/lib/report-repository";
import { ReportDashboard } from "@/components/report-dashboard";

export default async function ReportDetailPage({ params, searchParams }) {
  const user = await requireSessionUser();
  const route = await params;
  const query = await searchParams;
  const statusView = query?.view === "all" ? "all" : "pending";
  const search = String(query?.search || "").trim();
  const composeMode = query?.compose === "1";
  const pageError = String(query?.error || "");
  const reportId = Number(route.id);

  if (!Number.isFinite(reportId)) {
    notFound();
  }

  const selectedReport = await getReportById(reportId, user);

  return (
    <ReportDashboard
      currentUser={await getSessionUser()}
      reports={[]}
      statusView={statusView}
      search={search}
      selectedReport={selectedReport}
      error={pageError || (selectedReport ? null : "未找到该反馈，或你的权限不能查看它。")}
      composeMode={composeMode}
    />
  );
}
