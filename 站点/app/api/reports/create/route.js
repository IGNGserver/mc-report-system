import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/auth";
import { createReport } from "@/lib/report-repository";

export async function POST(request) {
  const user = await requireSessionUser();
  const formData = await request.formData();
  const title = String(formData.get("title") || "");
  const content = String(formData.get("content") || "");
  const visibility = String(formData.get("visibility") || "admin");
  const targets = formData.getAll("targets");
  const view = String(formData.get("view") || "all");
  const search = String(formData.get("search") || "");

  if (!content.trim()) {
    return redirectRelative(`/reports?compose=1&view=${view}&search=${encodeURIComponent(search)}&error=请填写反馈内容`);
  }

  const reportId = await createReport({
    title,
    content,
    visibility,
    targets,
    user
  });

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
