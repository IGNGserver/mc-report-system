import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }) {
  const user = await getSessionUser();
  if (user) {
    redirect("/reports");
  }

  const params = await searchParams;
  const error = params?.error || "";
  const loginType = params?.type === "player" ? "player" : "admin";

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">MC Server SaaS</div>
        <h1>举报与反馈中心</h1>
        <p className="muted">
          管理团队可查看权限范围内的反馈，玩家可登录后创建并管理自己发起的反馈。
        </p>

        {error ? <div className="alert">{error}</div> : null}

        <LoginForm initialLoginType={loginType} />
      </section>
    </main>
  );
}
