import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST(request) {
  await clearSession();
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/login"
    }
  });
}
