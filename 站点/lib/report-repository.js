import { isAdminUser, isSuperAdmin, normalizeAccountName } from "@/lib/auth";
import { ensureReportSchema, pool } from "@/lib/db";

function getOwnerAccount(user) {
  return normalizeAccountName(user.account || user.username);
}

function buildOwnerScope(user) {
  return {
    clause: "(r.reporter_type = ? AND r.reporter_account = ?)",
    params: [user.kind, getOwnerAccount(user)]
  };
}

function buildTargetScope(user) {
  return {
    clause: `
      (
        r.target_visibility = 'public'
        AND EXISTS (
          SELECT 1
          FROM report_targets rt_scope
          WHERE rt_scope.report_id = r.id
            AND LOWER(rt_scope.target_name) = ?
        )
      )
    `,
    params: [getOwnerAccount(user)]
  };
}

function buildViewScope(user) {
  if (isSuperAdmin(user)) {
    return { where: "", params: [] };
  }

  const ownerScope = buildOwnerScope(user);
  if (isAdminUser(user)) {
    return {
      where: `WHERE (r.visibility = 'admin' OR ${ownerScope.clause})`,
      params: ownerScope.params
    };
  }

  const targetScope = buildTargetScope(user);
  return {
    where: `WHERE (${ownerScope.clause} OR ${targetScope.clause})`,
    params: [...ownerScope.params, ...targetScope.params]
  };
}

function buildManageScope(user) {
  if (isSuperAdmin(user)) {
    return { where: "", params: [] };
  }

  const ownerScope = buildOwnerScope(user);
  if (isAdminUser(user)) {
    return {
      where: `WHERE (r.visibility = 'admin' OR ${ownerScope.clause})`,
      params: ownerScope.params
    };
  }

  return {
    where: `WHERE ${ownerScope.clause}`,
    params: ownerScope.params
  };
}

function buildReplyScope(user) {
  if (isSuperAdmin(user)) {
    return { where: "", params: [] };
  }

  const ownerScope = buildOwnerScope(user);
  if (isAdminUser(user)) {
    return {
      where: `WHERE (r.visibility = 'admin' OR ${ownerScope.clause})`,
      params: ownerScope.params
    };
  }

  const targetScope = buildTargetScope(user);
  return {
    where: `WHERE (${ownerScope.clause} OR ${targetScope.clause})`,
    params: [...ownerScope.params, ...targetScope.params]
  };
}

export function normalizeTargets(rawTargets) {
  const values = Array.isArray(rawTargets)
    ? rawTargets
    : String(rawTargets || "").includes(",")
      ? String(rawTargets || "").split(",")
      : [String(rawTargets || "")];

  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function canManageReport(user, report) {
  if (!report || !user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  const isOwner = report.reporter_type === user.kind && report.reporter_account === getOwnerAccount(user);
  if (isAdminUser(user)) {
    return report.visibility === "admin" || isOwner;
  }

  return isOwner;
}

function canReplyToReport(user, report) {
  if (!report || !user) {
    return false;
  }

  if (isSuperAdmin(user)) {
    return true;
  }

  const account = getOwnerAccount(user);
  const isOwner = report.reporter_type === user.kind && report.reporter_account === account;
  if (isOwner) {
    return true;
  }

  if (isAdminUser(user)) {
    return report.visibility === "admin";
  }

  return report.target_visibility === "public" && report.targets.some((target) => normalizeAccountName(target) === account);
}

function canViewAsTarget(user, report) {
  if (!report || !user || isAdminUser(user)) {
    return false;
  }

  const account = getOwnerAccount(user);
  return report.target_visibility === "public" && report.targets.some((target) => normalizeAccountName(target) === account);
}

async function replaceTargets(connection, reportId, targets) {
  const targetList = normalizeTargets(targets);
  await connection.query("DELETE FROM report_targets WHERE report_id = ?", [reportId]);

  if (targetList.length === 0) {
    return;
  }

  const values = targetList.map((targetName) => [reportId, null, targetName]);
  await connection.query(
    "INSERT INTO report_targets (report_id, target_uuid, target_name) VALUES ?",
    [values]
  );
}

async function loadTargets(reportId) {
  const [targetRows] = await pool.query(
    "SELECT target_name FROM report_targets WHERE report_id = ? ORDER BY id ASC",
    [reportId]
  );

  return targetRows.map((row) => row.target_name);
}

async function loadReplies(reportId) {
  const [replyRows] = await pool.query(
    `
      SELECT
        id,
        report_id,
        author_type,
        author_account,
        author_name,
        content,
        deleted_at,
        deleted_by_type,
        deleted_by_account,
        created_at,
        updated_at
      FROM report_replies
      WHERE report_id = ?
      ORDER BY created_at ASC, id ASC
    `,
    [reportId]
  );

  return replyRows;
}

function decorateReportForUser(report, user) {
  const targets = report.targets || [];
  const canManage = canManageReport(user, report);
  const canReply = canReplyToReport(user, report);
  const targetViewer = canViewAsTarget(user, report);

  return {
    ...report,
    targets,
    is_owner: report.reporter_type === user.kind && report.reporter_account === getOwnerAccount(user),
    is_target_viewer: targetViewer,
    can_manage: canManage,
    can_reply: canReply,
    can_toggle_target_visibility: canManage,
    can_delete_replies: isSuperAdmin(user)
  };
}

export async function listReports({ user, statusView, search }) {
  await ensureReportSchema();
  const scope = buildViewScope(user);
  const whereParts = [];
  const params = [...scope.params];

  if (scope.where) {
    whereParts.push(scope.where.replace(/^WHERE /, ""));
  }

  if (statusView !== "all") {
    whereParts.push("r.status = 'pending'");
  }

  if (search) {
    whereParts.push(`
      (
        r.title LIKE ?
        OR r.content LIKE ?
        OR r.reporter_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM report_targets rt_search
          WHERE rt_search.report_id = r.id
            AND rt_search.target_name LIKE ?
        )
      )
    `);
    const keyword = `%${search}%`;
    params.push(keyword, keyword, keyword, keyword);
  }

  const finalWhere = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
  const [rows] = await pool.query(
    `
      SELECT
        r.id,
        r.title,
        r.content,
        r.visibility,
        r.target_visibility,
        r.status,
        r.reporter_uuid,
        r.reporter_type,
        r.reporter_account,
        r.reporter_name,
        r.handled_by_user_id,
        r.handled_by_type,
        r.handled_by_account,
        r.created_at,
        r.updated_at,
        r.handled_at,
        (
          SELECT GROUP_CONCAT(rt.target_name ORDER BY rt.id SEPARATOR ', ')
          FROM report_targets rt
          WHERE rt.report_id = r.id
        ) AS target_names,
        (
          SELECT COUNT(*)
          FROM report_replies rr
          WHERE rr.report_id = r.id
        ) AS reply_count
      FROM reports r
      ${finalWhere}
      ORDER BY
        CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
        r.created_at DESC
    `,
    params
  );

  return rows;
}

async function getReportByIdWithScope(id, scope) {
  await ensureReportSchema();
  const where = scope.where ? `${scope.where} AND r.id = ?` : "WHERE r.id = ?";
  const params = [...scope.params, id];

  const [rows] = await pool.query(
    `
      SELECT
        r.id,
        r.title,
        r.content,
        r.visibility,
        r.target_visibility,
        r.status,
        r.reporter_uuid,
        r.reporter_type,
        r.reporter_account,
        r.reporter_name,
        r.handled_by_user_id,
        r.handled_by_type,
        r.handled_by_account,
        r.created_at,
        r.updated_at,
        r.handled_at,
        (
          SELECT GROUP_CONCAT(rt.target_name ORDER BY rt.id SEPARATOR ', ')
          FROM report_targets rt
          WHERE rt.report_id = r.id
        ) AS target_names
      FROM reports r
      ${where}
      LIMIT 1
    `,
    params
  );

  return rows[0] || null;
}

export async function getReportById(id, user) {
  const report = await getReportByIdWithScope(id, buildViewScope(user));
  if (!report) {
    return null;
  }

  report.targets = await loadTargets(id);
  report.replies = await loadReplies(id);
  return decorateReportForUser(report, user);
}

async function getManageableReport(id, user) {
  const report = await getReportByIdWithScope(id, buildManageScope(user));
  if (!report) {
    return null;
  }

  report.targets = await loadTargets(id);
  return report;
}

async function getReplyableReport(id, user) {
  const report = await getReportByIdWithScope(id, buildReplyScope(user));
  if (!report) {
    return null;
  }

  report.targets = await loadTargets(id);
  return report;
}

export async function createReport({ title, content, visibility, targets, user }) {
  await ensureReportSchema();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const reporterUuid = String(user.id || getOwnerAccount(user));
    const reporterType = user.kind;
    const reporterAccount = getOwnerAccount(user);
    const reporterName = String(user.displayName || user.username || reporterAccount).trim();

    const [result] = await connection.query(
      `
        INSERT INTO reports (
          title,
          content,
          visibility,
          target_visibility,
          reporter_uuid,
          reporter_type,
          reporter_account,
          reporter_name
        )
        VALUES (?, ?, ?, 'private', ?, ?, ?, ?)
      `,
      [
        String(title || "").trim(),
        String(content || "").trim(),
        visibility === "superadmin" ? "superadmin" : "admin",
        reporterUuid,
        reporterType,
        reporterAccount,
        reporterName
      ]
    );

    await replaceTargets(connection, result.insertId, targets);
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updateReportMeta({ id, title, targets, user }) {
  const report = await getManageableReport(id, user);
  if (!report) {
    return false;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("UPDATE reports SET title = ? WHERE id = ?", [String(title || "").trim(), id]);
    await replaceTargets(connection, id, targets);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function setReportTargetVisibility({ id, targetVisibility, user }) {
  const report = await getManageableReport(id, user);
  if (!report) {
    return false;
  }

  await pool.query(
    "UPDATE reports SET target_visibility = ? WHERE id = ?",
    [targetVisibility === "public" ? "public" : "private", id]
  );
  return true;
}

export async function createReportReply({ id, content, user }) {
  const report = await getReplyableReport(id, user);
  if (!report) {
    return false;
  }

  const cleaned = String(content || "").trim();
  if (!cleaned) {
    return false;
  }

  await pool.query(
    `
      INSERT INTO report_replies (
        report_id,
        author_type,
        author_account,
        author_name,
        content
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      id,
      user.kind,
      getOwnerAccount(user),
      String(user.displayName || user.username || getOwnerAccount(user)).trim(),
      cleaned
    ]
  );

  return true;
}

export async function deleteReportReply({ id, replyId, user }) {
  if (!isSuperAdmin(user)) {
    return false;
  }

  const report = await getReportById(id, user);
  if (!report) {
    return false;
  }

  const [result] = await pool.query(
    `
      UPDATE report_replies
      SET content = '',
          deleted_at = NOW(),
          deleted_by_type = ?,
          deleted_by_account = ?
      WHERE id = ?
        AND report_id = ?
        AND deleted_at IS NULL
    `,
    [user.kind, getOwnerAccount(user), replyId, id]
  );

  return result.affectedRows > 0;
}

export async function markReportResolved({ id, user }) {
  const report = await getManageableReport(id, user);
  if (!report) {
    return false;
  }

  const numericUserId = Number(user.id);
  await pool.query(
    `
      UPDATE reports
      SET status = 'resolved',
          handled_by_user_id = ?,
          handled_by_type = ?,
          handled_by_account = ?,
          handled_at = NOW()
      WHERE id = ?
    `,
    [
      Number.isFinite(numericUserId) ? numericUserId : null,
      user.kind,
      getOwnerAccount(user),
      id
    ]
  );

  return true;
}

export async function markReportPending({ id, user }) {
  const report = await getManageableReport(id, user);
  if (!report) {
    return false;
  }

  const numericUserId = Number(user.id);
  await pool.query(
    `
      UPDATE reports
      SET status = 'pending',
          handled_by_user_id = ?,
          handled_by_type = ?,
          handled_by_account = ?,
          handled_at = NULL
      WHERE id = ?
    `,
    [
      Number.isFinite(numericUserId) ? numericUserId : null,
      user.kind,
      getOwnerAccount(user),
      id
    ]
  );

  return true;
}
