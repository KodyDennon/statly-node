# Changelog

## [1.0.0] - 2025-12-27

### 🎉 First Stable Release

This is the first production-ready release of the Statly Observe SDK.

### ✨ Features

- **Automatic error capturing** with global error handlers
- **Manual error/message capturing** with context
- **User context tracking** for error attribution
- **Breadcrumbs** for debugging context
- **Release tracking** for deployment correlation
- **Tag support** for filtering and organization
- **Event batching** for efficient network usage
- **Framework integrations** for Express, Next.js, and Fastify
- **TypeScript support** with full type definitions
- **Sample rate control** for production environments
- **beforeSend hook** for filtering/modifying events

### 🔒 Security

- **Prefix-based DSN authentication** - DSN now contains only a 16-character public key prefix (e.g., `sk_live_a1b2c3d4`)
- Safe to embed in client-side code and commit to version control
- Full API keys reserved for server-side operations only

### 📖 Documentation

- Comprehensive README with examples
- Framework-specific integration guides
- TypeScript type documentation
- Clear DSN vs API key distinction

### 🐛 Bug Fixes

- Fixed DSN format to use public-safe prefix instead of full API key
- Updated all examples to show correct prefix format

### 💥 Breaking Changes

None - this is the initial stable release.

---

## [0.1.2] - 2025-12-26

Beta release for testing.

## [0.1.1] - 2025-12-25

Alpha release for initial development.

## [0.1.0] - 2025-12-24

Initial development version.
