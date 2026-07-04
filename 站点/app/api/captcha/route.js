import { issueCaptchaChallenge } from "@/lib/auth";

export async function GET() {
  return Response.json(issueCaptchaChallenge(), {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
    }
  });
}
