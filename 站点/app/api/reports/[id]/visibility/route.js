import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { setReportTargetVisibility } from "@/lib/report-repository";

export async function POST(request, { params }) {
  const user = await requireSessionUser();
  const route = await params;
  const reportId = Number(route.id);
  const formData = await request.formData();
  const view = String(formData.get("view") || "all");
  const search = String(formData.get("search") || "");
  const targetVisibility = String(formData.get("targetVisibility") || "private");

  const ok = await setReportTargetVisibility({
    id: reportId,
    targetVisibility,
    user
  });

  if (!ok) {
    return redirectRelative(`/reports?view=${view}&search=${encodeURIComponent(search)}&error=你没有权限修改这条工单的涉事玩家可见性。`);
  }

  return redirectRelative(`/reports/${reportId}?view=${view}&search=${encodeURIComponent(search)}`);
}

function redirectRelative(location) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: encodeURI(location)
    }
  });
}
