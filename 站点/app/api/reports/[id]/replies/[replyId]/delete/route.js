import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { deleteReportReply } from "@/lib/report-repository";

export async function POST(request, { params }) {
  const user = await requireSessionUser();
  const route = await params;
  const reportId = Number(route.id);
  const replyId = Number(route.replyId);
  const formData = await request.formData();
  const view = String(formData.get("view") || "all");
  const search = String(formData.get("search") || "");

  const ok = await deleteReportReply({
    id: reportId,
    replyId,
    user
  });

  if (!ok) {
    return redirectRelative(`/reports/${reportId}?view=${view}&search=${encodeURIComponent(search)}&error=只有超级管理员可以删除回复，或该回复已不存在。`);
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
