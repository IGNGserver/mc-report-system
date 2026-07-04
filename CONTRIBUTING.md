# Contributing to mc-report-system

Thanks for your interest in improving `mc-report-system`.

This project aims to stay lightweight, easy to deploy, and easy for players to use. When contributing, please try to keep that direction in mind.

## What We Welcome

- Bug fixes
- Documentation improvements
- UI / UX improvements that keep the workflow simple
- Better Folia compatibility
- Better AuthMe compatibility
- Performance and reliability improvements

## Before You Contribute

Please try to:

- Keep changes focused
- Avoid unrelated refactors in the same commit
- Preserve the lightweight design goal
- Avoid introducing private credentials, local deployment scripts, or server-specific data

## Development Notes

### Plugin

The plugin source is under [插件](./插件).

Build with:

```bash
cd 插件
./gradlew build
```

Windows:

```powershell
cd 插件
.\gradlew.bat build
```

### Web Panel

The web panel source is under [站点](./站点).

Run locally with:

```bash
cd 站点
npm install
npm run dev
```

## Pull Request Guidance

If you open a pull request, it helps a lot if you describe:

- What problem you are solving
- What behavior changed
- Whether the change affects the plugin, the web panel, or both
- Any setup steps reviewers should know

## Code Style Expectations

- Keep configuration externalized
- Do not commit real secrets or deployment credentials
- Prefer clear and maintainable code over clever code
- Keep UI copy understandable for ordinary players and administrators

## Scope

This project is intentionally focused on:

- in-game report submission
- lightweight web-based handling
- player login via AuthMe integration
- ticket-style follow-up conversations

Large feature additions are welcome, but they should still fit the overall direction of the project.
