# mc-report-system

一个精简、轻量、容易上手的 Minecraft 举报 / 反馈系统，分为插件端和网页端。

它的重点不是做一个复杂的全能后台，而是让玩家可以快速发起反馈，让管理团队更顺手地处理工单。项目还支持接入 AuthMe 数据库，玩家可以直接用游戏账号一键登录网站，无需单独注册后台账号。

## 功能特色

- 游戏内使用 `/report` 发起举报
- 指令帮助、候选词提示、悬浮说明均为中文
- 支持多个涉事玩家
- 支持离线玩家名
- 举报默认仅管理团队可见，可按需要向涉事玩家开放工单
- 支持连续对话：发起玩家、涉事玩家、管理团队都可以在同一工单下回复
- 仅超级管理员可以删除回复
- 网站支持管理员登录和玩家登录双模式
- 玩家登录支持 AuthMe 数据库直连
- 玩家可直接管理自己发起的反馈
- 搜索支持标题、内容、涉事玩家、发起人

## 项目结构

- [插件](./插件)：Folia 兼容的 Minecraft 举报插件
- [站点](./站点)：Next.js 网页端工单系统
- [数据库](./数据库)：基础表结构脚本

## 支持版本

### 插件端

- 服务端 API：`Folia API 26.1.2`
- `plugin.yml`：`api-version: 26.1.2`
- 已按 `folia-supported: true` 构建
- 构建 JDK：`Java 25`
- 适用目标：`Folia 26.1.2 / Lophine 26.1.2`

### 站点端

- `Next.js 16`
- `React 19`
- `Node.js 24+` 推荐
- `MySQL 8.0+` 推荐
- AuthMe：兼容常见 MySQL 表结构，字段名可通过环境变量适配

## 插件端说明

### 指令

- `/report`
- `/report help`
- `/report create <admin|superadmin> <targets> <reason>`
- 别名：`/mcreport`

### 可见范围

- `admin`：所有管理员可见
- `superadmin`：仅超级管理员可见

### 目标玩家输入

- 单个玩家：直接填写
- 多个玩家：用英文逗号分隔
- 支持离线玩家名

### 插件配置

编辑 [插件/src/main/resources/config.yml](./插件/src/main/resources/config.yml)：

- `database.host`
- `database.port`
- `database.name`
- `database.username`
- `database.password`
- `database.parameters`

## 站点端说明

### 登录模式

- 管理团队：使用站点业务库中的用户表登录
- 玩家：使用 AuthMe 数据库登录

### 反馈权限

- `superadmin`：可查看全部反馈，可删除回复
- `admin`：可查看 `visibility=admin` 的反馈，以及自己发起的反馈
- `player`：可查看并管理自己发起的反馈
- 涉事玩家：仅在工单开放后可查看并回复该工单

### 环境变量

复制 [站点/.env.example](./站点/.env.example) 为 `.env.local` 后填写：

#### 业务库

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

#### AuthMe 数据库

- `AUTHME_DB_HOST`
- `AUTHME_DB_PORT`
- `AUTHME_DB_NAME`
- `AUTHME_DB_USER`
- `AUTHME_DB_PASSWORD`

#### 站点认证

- `AUTH_SECRET`
- `AUTH_COOKIE_SECURE`

#### 管理员用户表映射

- `USER_TABLE`
- `USER_ID_COLUMN`
- `USER_USERNAME_COLUMN`
- `USER_PASSWORD_HASH_COLUMN`
- `USER_ROLE_COLUMN`
- `USER_DISPLAY_NAME_COLUMN`

#### AuthMe 字段映射

- `AUTHME_TABLE`
- `AUTHME_ID_COLUMN`
- `AUTHME_USERNAME_COLUMN`
- `AUTHME_REALNAME_COLUMN`
- `AUTHME_PASSWORD_COLUMN`
- `AUTHME_SALT_COLUMN`
- `AUTHME_EMAIL_COLUMN`
- `AUTHME_REGDATE_COLUMN`

## 本地开发

### 站点端

```bash
cd 站点
npm install
npm run dev
```

默认监听端口：`3217`

### 生产构建

```bash
cd 站点
npm install
npm run build
npm run start
```

### 插件端构建

```bash
cd 插件
gradle build
```

生成的 Jar 位于：

- `插件/build/libs/`

## 数据库

项目提供了基础 SQL 文件：

- [数据库/report_schema.sql](./数据库/report_schema.sql)

站点端也包含自动建表 / 自动补字段逻辑，可直接配好数据库后启动。

## 适用场景

- 想要一套轻量级举报系统，而不是复杂审核平台
- 想让玩家更容易上手提反馈
- 已经在服务器使用 AuthMe，希望玩家无需额外注册网站账号
- 需要支持游戏内发起、网页端处理、连续对话跟进

## 发布建议

- GitHub 仓库建议发布源码、`.env.example`、示例配置和数据库脚本
- 不要提交真实 `.env.local`
- 不要提交测试账号、远程部署脚本、服务器备份和本地测试服务端

