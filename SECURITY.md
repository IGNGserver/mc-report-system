# Security Policy

## Supported Versions

At the moment, security fixes are only guaranteed for the latest public version of this project.

## Reporting a Vulnerability

Please do **not** open a public GitHub issue for sensitive security problems.

If you discover a vulnerability, please report it privately first. Include:

- a short description of the issue
- affected component: plugin, web panel, or both
- reproduction steps
- impact you expect
- any suggested fix if available

## Examples of Sensitive Issues

- authentication bypass
- permission bypass
- exposure of report data
- SQL injection
- credential leakage
- arbitrary file access

## Disclosure

After the issue is reviewed and fixed, it can be disclosed publicly in a coordinated way.

## Important Reminder

Do not commit:

- real database passwords
- production `.env.local`
- remote deployment scripts with credentials
- private test accounts
