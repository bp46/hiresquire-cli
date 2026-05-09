# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2026-05-09

### Added
- Added `credits` command for balance management and auto-reload.
- Added `calendar` and `interviews` commands for scheduling.
- Added `agent-keys` command for per-agent API key management.
- Added `whoami` command for token verification.
- Support for `Idempotency-Key` headers on all job creation.

### Changed
- Improved error handling for autonomous agents.
- Updated documentation with agent-specific integration examples.

## [1.2.1] - 2026-05-01

### Added
- Initial release with `screen`, `jobs`, `results`, and `status` commands.
- Support for JSON output and watch mode.
- Resume parsing for PDF, DOCX, and TXT.
