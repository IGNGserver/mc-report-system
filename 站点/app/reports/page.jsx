import { getSessionUser, requireSessionUser } from "@/lib/auth";
import { listReports } from "@/lib/report-repository";
import { ReportDashboard } from "@/components/report-dashboard";

export default async function ReportsPage({ searchParams }) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const statusView = params?.view === "all" ? "all" : "pending";
  const search = String(params?.search || "").trim();
  const composeMode = params?.compose === "1";
  const error = String(params?.error || "");
  const reports = await listReports({ user, statusView, search });

  return (
    <ReportDashboard
      currentUser={await getSessionUser()}
      reports={reports}
      statusView={statusView}
      search={search}
      selectedReport={null}
      error={error || null}
      composeMode={composeMode}
    />
  );
}
