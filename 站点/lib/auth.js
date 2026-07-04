import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authMePool, ensureReportSchema, pool } from "@/lib/db";

const SESSION_COOKIE = "mc_report_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
const CAPTCHA_MAX_AGE = 60 * 5;

const userTable = process.env.USER_TABLE || "users";
const idColumn = process.env.USER_ID_COLUMN || "id";
const usernameColumn = process.env.USER_USERNAME_COLUMN || "username";
const passwordHashColumn = process.env.USER_PASSWORD_HASH_COLUMN || "password_hash";
const roleColumn = process.env.USER_ROLE_COLUMN || "role";
const displayNameColumn = process.env.USER_DISPLAY_NAME_COLUMN || "display_name";

const authMeTable = process.env.AUTHME_TABLE || "authme";
const authMeIdColumn = process.env.AUTHME_ID_COLUMN || "id";
const authMeUsernameColumn = process.env.AUTHME_USERNAME_COLUMN || "username";
const authMeRealNameColumn = process.env.AUTHME_REALNAME_COLUMN || "realname";
const authMePasswordColumn = process.env.AUTHME_PASSWORD_COLUMN || "password";
const authMeSaltColumn = Object.prototype.hasOwnProperty.call(process.env, "AUTHME_SALT_COLUMN")
  ? (process.env.AUTHME_SALT_COLUMN || "").trim()
  : "salt";
const authMeEmailColumn = process.env.AUTHME_EMAIL_COLUMN || "email";
const authMeRegDateColumn = process.env.AUTHME_REGDATE_COLUMN || "regdate";

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) {
    throw new Error("AUTH_SECRET 未设置");
  }
  return secret;
}

function shouldUseSecureCookies() {
  const configured = String(process.env.AUTH_COOKIE_SECURE || "").trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false") {
    return false;
  }
  return false;
}

function signPayload(payload) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyPayload(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", getAuthSecret()).update(encoded).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function normalizeAccountName(value) {
  return String(value || "").trim().toLowerCase();
}

export function isSuperAdmin(user) {
  return user?.kind === "admin" && user?.role === "superadmin";
}

export function isAdminUser(user) {
  return user?.kind === "admin";
}

export function buildSessionUser(user) {
  return {
    kind: user.kind,
    id: String(user.id),
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role,
    account: normalizeAccountName(user.account || user.username)
  };
}

export async function findAdminUserByUsername(username) {
  await ensureReportSchema();
  const normalized = normalizeAccountName(username);
  const sql = `
    SELECT
      ${quoteIdentifier(idColumn)} AS id,
      ${quoteIdentifier(usernameColumn)} AS username,
      ${quoteIdentifier(passwordHashColumn)} AS passwordHash,
      ${quoteIdentifier(roleColumn)} AS role,
      ${quoteIdentifier(displayNameColumn)} AS displayName
    FROM ${quoteIdentifier(userTable)}
    WHERE LOWER(${quoteIdentifier(usernameColumn)}) = ?
    LIMIT 1
  `;

  const [rows] = await pool.query(sql, [normalized]);
  return rows[0] || null;
}

async function verifyAuthMePassword(password, user) {
  const storedHash = String(user.passwordHash || "");
  const salt = String(user.salt || "");

  if (!storedHash) {
    return false;
  }

  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    return bcrypt.compare(password, storedHash);
  }

  if (storedHash.startsWith("$SHA$")) {
    const parts = storedHash.split("$");
    const iterations = Number(parts[2] || "0");
    const hashSalt = parts[3] || salt;
    const expectedHash = parts[4] || "";
    if (!iterations || !hashSalt || !expectedHash) {
      return false;
    }

    let digest = crypto.createHash("sha256").update(`${password}${hashSalt}`, "utf8").digest("hex");
    for (let index = 1; index < iterations; index += 1) {
      digest = crypto.createHash("sha256").update(digest, "utf8").digest("hex");
    }

    return digest.length === expectedHash.length && digest === expectedHash;
  }

  if (salt) {
    const sha256 = crypto.createHash("sha256").update(`${password}${salt}`, "utf8").digest("hex");
    const sha256Double = crypto.createHash("sha256").update(sha256, "utf8").digest("hex");
    const sha1 = crypto.createHash("sha1").update(`${password}${salt}`, "utf8").digest("hex");
    return [sha256, sha256Double, sha1].includes(storedHash);
  }

  const plainSha256 = crypto.createHash("sha256").update(password, "utf8").digest("hex");
  const plainSha1 = crypto.createHash("sha1").update(password, "utf8").digest("hex");
  const plainMd5 = crypto.createHash("md5").update(password, "utf8").digest("hex");
  return [plainSha256, plainSha1, plainMd5].includes(storedHash);
}

export async function findPlayerByUsername(username) {
  const normalized = normalizeAccountName(username);
  const saltSelect = authMeSaltColumn
    ? `${quoteIdentifier(authMeSaltColumn)} AS salt`
    : "NULL AS salt";
  const sql = `
    SELECT
      ${quoteIdentifier(authMeIdColumn)} AS id,
      ${quoteIdentifier(authMeUsernameColumn)} AS username,
      ${quoteIdentifier(authMeRealNameColumn)} AS realName,
      ${quoteIdentifier(authMePasswordColumn)} AS passwordHash,
      ${saltSelect},
      ${quoteIdentifier(authMeEmailColumn)} AS email,
      ${quoteIdentifier(authMeRegDateColumn)} AS registeredAt
    FROM ${quoteIdentifier(authMeTable)}
    WHERE LOWER(${quoteIdentifier(authMeRealNameColumn)}) = ?
       OR LOWER(${quoteIdentifier(authMeUsernameColumn)}) = ?
    ORDER BY CASE WHEN LOWER(${quoteIdentifier(authMeRealNameColumn)}) = ? THEN 0 ELSE 1 END
    LIMIT 1
  `;

  const [rows] = await authMePool.query(sql, [normalized, normalized, normalized]);
  return rows[0] || null;
}

export async function authenticateAdmin(username, password) {
  const user = await findAdminUserByUsername(username);
  if (!user) {
    return null;
  }

  const matched = await bcrypt.compare(password, user.passwordHash);
  if (!matched) {
    return null;
  }

  return buildSessionUser({
    kind: "admin",
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || "admin",
    account: user.username
  });
}

export async function authenticatePlayer(username, password) {
  const user = await findPlayerByUsername(username);
  if (!user) {
    return null;
  }

  const matched = await verifyAuthMePassword(password, user);
  if (!matched) {
    return null;
  }

  const displayUsername = user.realName || user.username || username;
  return buildSessionUser({
    kind: "player",
    id: user.id || normalizeAccountName(displayUsername),
    username: displayUsername,
    displayName: displayUsername,
    role: "player",
    account: user.realName || user.username || username
  });
}

export async function authenticate(loginType, username, password) {
  if (loginType === "player") {
    return authenticatePlayer(username, password);
  }

  return authenticateAdmin(username, password);
}

export async function createSession(user) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, signPayload(user), {
    httpOnly: true,
    secure: shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return verifyPayload(token);
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export function generateCaptchaSvg(text) {
  const safeText = String(text || "").toUpperCase();
  const letters = safeText.split("");
  const width = 180;
  const height = 64;
  const glyphs = letters
    .map((char, index) => {
      const x = 20 + index * 30;
      const y = 42 + ((index % 2 === 0) ? 4 : -2);
      const rotate = (index % 2 === 0 ? -12 : 10) + index;
      return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="18" fill="#f9fcff"/>
      <path d="M12 45 C44 12, 72 58, 104 28 S150 6, 168 34" fill="none" stroke="#9ac7f4" stroke-width="3"/>
      <path d="M8 20 C32 54, 86 4, 126 42 S170 52, 174 18" fill="none" stroke="#ffd38b" stroke-width="3"/>
      <g font-family="Segoe UI, Microsoft YaHei UI, sans-serif" font-size="28" font-weight="700" fill="#17324a">
        ${glyphs}
      </g>
    </svg>
  `.trim();
}

function randomCaptchaText(length = 5) {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function issueCaptchaChallenge() {
  const answer = randomCaptchaText();
  const token = signPayload({
    purpose: "captcha",
    answer,
    nonce: crypto.randomUUID(),
    createdAt: Date.now()
  });

  return {
    token,
    image: `data:image/svg+xml;base64,${Buffer.from(generateCaptchaSvg(answer), "utf8").toString("base64")}`
  };
}

export function verifyCaptcha(input, token) {
  const payload = verifyPayload(token);
  if (!payload || payload.purpose !== "captcha" || !payload.answer || !payload.createdAt) {
    return false;
  }

  if (Date.now() - Number(payload.createdAt) > CAPTCHA_MAX_AGE * 1000) {
    return false;
  }

  return normalizeAccountName(input) === normalizeAccountName(payload.answer);
}
