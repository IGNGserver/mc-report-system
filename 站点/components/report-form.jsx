"use client";

import { useState } from "react";

export function ReportForm({
  action,
  submitLabel,
  title = "",
  content = "",
  visibility = "admin",
  targets = [""],
  readOnlyContent = false,
  showContentEditor = false,
  showVisibilitySelect = false,
  view = "pending",
  search = ""
}) {
  const [targetRows, setTargetRows] = useState(
    Array.isArray(targets) && targets.length > 0 ? targets : [""]
  );

  function updateTarget(index, value) {
    setTargetRows((rows) => rows.map((item, currentIndex) => (currentIndex === index ? value : item)));
  }

  function addTargetRow() {
    setTargetRows((rows) => [...rows, ""]);
  }

  function removeTargetRow(index) {
    setTargetRows((rows) => {
      if (rows.length === 1) {
        return [""];
      }

      return rows.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  return (
    <form method="post" action={action} className="stack">
      <input type="hidden" name="view" value={view} />
      <input type="hidden" name="search" value={search} />

      <label>
        <span>举报标题</span>
        <input
          type="text"
          name="title"
          maxLength="120"
          defaultValue={title}
          placeholder="例如：主城恶意骚扰"
        />
      </label>

      {showVisibilitySelect ? (
        <label>
          <span>可见范围</span>
          <select name="visibility" defaultValue={visibility}>
            <option value="admin">所有管理员</option>
            <option value="superadmin">仅超级管理员</option>
          </select>
        </label>
      ) : null}

      <div className="stack">
        <span className="field-label">涉事玩家</span>
        {targetRows.map((target, index) => (
          <div className="target-row" key={index}>
            <input
              type="text"
              name="targets"
              value={target}
              placeholder="一行填写一名玩家"
              onChange={(event) => updateTarget(index, event.target.value)}
            />
            <button type="button" className="secondary icon-button" onClick={() => removeTargetRow(index)}>
              删除
            </button>
          </div>
        ))}
        <button type="button" className="secondary" onClick={addTargetRow}>
          + 添加玩家
        </button>
      </div>

      <label>
        <span>举报内容</span>
        {showContentEditor ? (
          <textarea name="content" rows="8" defaultValue={content} placeholder="请用中文详细描述情况。" required />
        ) : (
          <textarea name="content" rows="8" defaultValue={content} readOnly={readOnlyContent} />
        )}
      </label>

      <button type="submit">{submitLabel}</button>
    </form>
  );
}
