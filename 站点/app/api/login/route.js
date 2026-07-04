import { NextResponse } from "next/server";
import { authenticate, createSession, verifyCaptcha } from "@/lib/auth";

export async function POST(request) {
  const formData = await request.formData();
  const loginType = String(formData.get("loginType") || "admin").trim() === "player" ? "player" : "admin";
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  const captcha = String(formData.get("captcha") || "").trim();
  const captchaToken = String(formData.get("captchaToken") || "");

  const captchaOk = verifyCaptcha(captcha, captchaToken);
  if (!captchaOk) {
    return redirectRelative(`/login?type=${loginType}&error=验证码错误或已过期，请重试`);
  }

  const user = await authenticate(loginType, username, password);
  if (!user) {
    return redirectRelative(`/login?type=${loginType}&error=用户名或密码错误`);
  }

  await createSession(user);
  return redirectRelative("/reports");
}

function redirectRelative(location) {
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: encodeURI(location)
    }
  });
}
