import Link from "next/link";
import { ReportForm } from "@/components/report-form";

export function ReportDashboard({
  currentUser,
  reports,
  statusView,
  search,
  selectedReport,
  error,
  composeMode
}) {
  const createHref = `/reports?view=${statusView}&search=${encodeURIComponent(search)}&compose=1`;
  const listHref = `/reports?view=${statusView}&search=${encodeURIComponent(search)}`;
  const showingDetail = !composeMode && Boolean(selectedReport);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="eyebrow">MC Server SaaS</div>
          <h1>举报与反馈中心</h1>
          <p className="muted">
            当前身份：<strong>{currentUser.displayName}</strong> / {currentUser.kind === "player" ? "player" : currentUser.role}
          </p>
        </div>

        <Link href={createHref} className="primary-link">
          创建反馈
        </Link>

        <form method="get" action="/reports" className="stack">
          <label>
            <span>搜索当前范围</span>
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="搜索举报对象、标题、内容、发起人"
            />
          </label>
          <input type="hidden" name="view" value={statusView} />
          <button type="submit">搜索</button>
        </form>

        <div className="toggle-row">
          <Link
            className={statusView === "pending" ? "active" : ""}
            href={`/reports?view=pending&search=${encodeURIComponent(search)}`}
          >
            仅看待处理
          </Link>
          <Link
            className={statusView === "all" ? "active" : ""}
            href={`/reports?view=all&search=${encodeURIComponent(search)}`}
          >
            查看全部
          </Link>
        </div>

        <form method="post" action="/api/logout">
          <button type="submit" className="secondary">退出登录</button>
        </form>
      </aside>

      <main className={showingDetail ? "content-column" : "list-column"}>
        {!showingDetail ? (
          <section className="panel list-panel">
            <div className="panel-header">
              <h2>{composeMode ? "反馈列表" : "工单列表"}</h2>
              <span>{reports.length} 条</span>
            </div>

            {error ? <div className="alert section-alert">{error}</div> : null}

            {composeMode ? (
              <div className="list-hint">
                创建反馈会跳转到独立页面填写，工单详情也会在新页面中查看。
              </div>
            ) : null}

            {reports.length === 0 ? <div className="empty-state">当前筛选范围内没有反馈信息。</div> : null}

            {reports.map((report) => (
              <Link
                key={report.id}
                className={`report-card ${selectedReport?.id === report.id ? "selected" : ""}`}
                href={`/reports/${report.id}?view=${statusView}&search=${encodeURIComponent(search)}`}
              >
                <div className="report-card-top">
                  <strong>{report.title || "未命名反馈"}</strong>
                  <span className={`pill ${report.status}`}>
                    {report.status === "pending" ? "待处理" : "已处理"}
                  </span>
                </div>
                <p>涉事玩家：{report.target_names || "未填写"}</p>
                <p>反馈发起人：{report.reporter_name}</p>
                <p>提交时间：{formatDateTime(report.created_at)}</p>
                <div className="card-badges">
                  <span className={`pill ${report.visibility}`}>{report.visibility}</span>
                  <span className={`pill ${report.target_visibility === "public" ? "resolved" : "pending"}`}>
                    {report.target_visibility === "public" ? "涉事玩家可见" : "涉事玩家未开放"}
                  </span>
                  <span className="pill">回复 {report.reply_count || 0}</span>
                </div>
              </Link>
            ))}
          </section>
        ) : null}

        {composeMode ? (
          <section className="panel detail-panel wide-panel">
            <div className="panel-header">
              <h2>创建反馈</h2>
              <span className="pill admin">新建</span>
            </div>
            <ReportForm
              action="/api/reports/create"
              submitLabel="提交反馈"
              showContentEditor
              readOnlyContent={false}
              visibility="admin"
              showVisibilitySelect
              targets={[""]}
              view={statusView}
              search={search}
            />
          </section>
        ) : null}

        {showingDetail ? (
          <section className="panel detail-panel wide-panel">
            {error ? <div className="alert section-alert">{error}</div> : null}

            <div className="detail-topbar">
              <Link href={listHref} className="back-link">
                返回工单列表
              </Link>
              <span className="detail-hint">详情页已单独展开，便于查看更多内容与回复记录。</span>
            </div>

            <div className="panel-header">
              <h2>#{selectedReport.id} 工单详情</h2>
              <span className={`pill ${selectedReport.visibility}`}>{selectedReport.visibility}</span>
            </div>

            <div className="meta-grid">
              <div><span>反馈发起人</span><strong>{selectedReport.reporter_name}</strong></div>
              <div><span>记录时间</span><strong>{formatDateTime(selectedReport.created_at)}</strong></div>
              <div><span>状态</span><strong>{selectedReport.status === "pending" ? "待处理" : "已处理"}</strong></div>
              <div><span>涉事玩家可见性</span><strong>{selectedReport.target_visibility === "public" ? "已开放" : "未开放"}</strong></div>
            </div>

            <div className="ticket-section">
              <div className="section-head">
                <h3>原始举报内容</h3>
                {selectedReport.can_toggle_target_visibility ? (
                  <form method="post" action={`/api/reports/${selectedReport.id}/visibility`}>
                    <input type="hidden" name="view" value={statusView} />
                    <input type="hidden" name="search" value={search} />
                    <input
                      type="hidden"
                      name="targetVisibility"
                      value={selectedReport.target_visibility === "public" ? "private" : "public"}
                    />
                    <button type="submit" className="secondary">
                      {selectedReport.target_visibility === "public" ? "关闭涉事玩家查看" : "向涉事玩家开放工单"}
                    </button>
                  </form>
                ) : null}
              </div>

              <div className="message-card origin-card">
                <div className="message-meta">
                  <strong>{selectedReport.reporter_name}</strong>
                  <span>{selectedReport.reporter_type === "admin" ? "管理团队" : selectedReport.is_target_viewer ? "涉事玩家可见工单" : "玩家"}</span>
                  <time>{formatDateTime(selectedReport.created_at)}</time>
                </div>
                <div className="message-content">{selectedReport.content || "未填写内容"}</div>
              </div>
            </div>

            {selectedReport.can_manage ? (
              <>
                <ReportForm
                  action={`/api/reports/${selectedReport.id}/update`}
                  submitLabel="保存标题和涉事玩家"
                  title={selectedReport.title}
                  content={selectedReport.content}
                  visibility={selectedReport.visibility}
                  targets={selectedReport.targets}
                  readOnlyContent
                  view={statusView}
                  search={search}
                />

                {selectedReport.status === "pending" ? (
                  <form method="post" action={`/api/reports/${selectedReport.id}/resolve`} className="stack">
                    <input type="hidden" name="view" value={statusView} />
                    <input type="hidden" name="search" value={search} />
                    <button type="submit" className="success">处理完成</button>
                  </form>
                ) : (
                  <form method="post" action={`/api/reports/${selectedReport.id}/reopen`} className="stack">
                    <input type="hidden" name="view" value={statusView} />
                    <input type="hidden" name="search" value={search} />
                    <button type="submit" className="secondary">改回待处理</button>
                  </form>
                )}
              </>
            ) : (
              <div className="readonly-block">
                <div><span>标题</span><strong>{selectedReport.title || "未命名反馈"}</strong></div>
                <div><span>涉事玩家</span><strong>{selectedReport.targets.join("、") || "未填写"}</strong></div>
              </div>
            )}

            <div className="ticket-section">
              <div className="section-head">
                <h3>工单回复</h3>
                <span>{selectedReport.replies.length} 条</span>
              </div>

              {selectedReport.replies.length === 0 ? (
                <div className="empty-state compact">当前还没有回复，下面可以继续跟进这条工单。</div>
              ) : (
                <div className="reply-list">
                  {selectedReport.replies.map((reply) => (
                    <article key={reply.id} className={`message-card ${reply.deleted_at ? "deleted" : ""}`}>
                      <div className="message-meta">
                        <strong>{reply.author_name}</strong>
                        <span>{formatActorType(reply.author_type, selectedReport, reply)}</span>
                        <time>{formatDateTime(reply.created_at)}</time>
                      </div>
                      <div className="message-content">
                        {reply.deleted_at ? "该回复内容已被超级管理员删除。" : reply.content}
                      </div>
                      {selectedReport.can_delete_replies && !reply.deleted_at ? (
                        <form method="post" action={`/api/reports/${selectedReport.id}/replies/${reply.id}/delete`}>
                          <input type="hidden" name="view" value={statusView} />
                          <input type="hidden" name="search" value={search} />
                          <button type="submit" className="secondary small-button">删除回复</button>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}

              {selectedReport.can_reply ? (
                <form method="post" action={`/api/reports/${selectedReport.id}/replies/create`} className="stack reply-form">
                  <input type="hidden" name="view" value={statusView} />
                  <input type="hidden" name="search" value={search} />
                  <label>
                    <span>继续回复</span>
                    <textarea
                      name="content"
                      rows="4"
                      maxLength="3000"
                      placeholder="继续补充情况、沟通处理结果或留下说明。"
                      required
                    />
                  </label>
                  <button type="submit">发送回复</button>
                </form>
              ) : (
                <div className="hint-strip">当前身份只能查看此工单，不能继续回复。</div>
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function formatActorType(type, report, reply) {
  if (type === "admin") {
    return "管理团队";
  }

  if (reply.author_account === report.reporter_account) {
    return "发起玩家";
  }

  return "涉事玩家";
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}
