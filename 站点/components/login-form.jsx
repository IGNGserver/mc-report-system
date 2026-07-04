"use client";

import { useEffect, useState } from "react";

export function LoginForm({ initialLoginType = "admin" }) {
  const [loginType, setLoginType] = useState(initialLoginType === "player" ? "player" : "admin");
  const [captchaSrc, setCaptchaSrc] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");

  function handleKeyDown(event) {
    if (event.key !== "Enter") {
      return;
    }

    const form = event.currentTarget.form;
    if (!form) {
      return;
    }

    event.preventDefault();
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
      return;
    }

    form.submit();
  }

  async function loadCaptcha() {
    const response = await fetch(`/api/captcha?ts=${Date.now()}`, {
      cache: "no-store"
    });
    const payload = await response.json();
    setCaptchaSrc(payload.image || "");
    setCaptchaToken(payload.token || "");
  }

  useEffect(() => {
    loadCaptcha();
  }, []);

  function refreshCaptcha() {
    void loadCaptcha();
  }

  return (
    <form method="post" action="/api/login" className="stack">
      <div className="toggle-row">
        <button
          type="button"
          className={loginType === "admin" ? "tab-button active" : "tab-button"}
          onClick={() => setLoginType("admin")}
        >
          管理团队登录
        </button>
        <button
          type="button"
          className={loginType === "player" ? "tab-button active" : "tab-button"}
          onClick={() => setLoginType("player")}
        >
          玩家登录
        </button>
      </div>

      <input type="hidden" name="loginType" value={loginType} />
      <input type="hidden" name="captchaToken" value={captchaToken} />

      <label>
        <span>{loginType === "player" ? "玩家名" : "用户名"}</span>
        <input
          type="text"
          name="username"
          required
          autoFocus
          autoComplete="username"
          onKeyDown={handleKeyDown}
        />
      </label>
      <label>
        <span>密码</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          onKeyDown={handleKeyDown}
        />
      </label>

      <label>
        <span>验证码</span>
        <div className="captcha-row">
          <input
            type="text"
            name="captcha"
            required
            maxLength={5}
            placeholder="输入右侧验证码"
            onKeyDown={handleKeyDown}
          />
          <img className="captcha-image" src={captchaSrc} alt="登录验证码" />
          <button type="button" className="secondary captcha-refresh" onClick={refreshCaptcha}>
            刷新
          </button>
        </div>
      </label>

      <button type="submit">{loginType === "player" ? "以玩家身份登录" : "登录后台"}</button>
    </form>
  );
}
