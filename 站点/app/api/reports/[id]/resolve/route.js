import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { markReportResolved } from "@/lib/report-repository";

export async function POST(request, { params }) {
  const user = await requireSessionUser();
  const route = await params;
  const reportId = Number(route.id);
  const formData = await request.formData();
  const view = String(formData.get("view") || "all");
  const search = String(formData.get("search") || "");

  const ok = await markReportResolved({
    id: reportId,
    user
  });

  if (!ok) {
    return redirectRelative(`/reports?view=${view}&search=${encodeURIComponent(search)}&error=未找到该反馈，或你的权限不能处理它。`);
  }

  return redirectRelative(`/reports/${reportId}?view=all&search=${encodeURIComponent(search)}`);
}

function redirectRelative(location) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: encodeURI(location)
    }
  });
}
