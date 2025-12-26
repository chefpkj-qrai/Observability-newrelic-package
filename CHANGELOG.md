# Changelog

## [7.1.0] - 2025-12-26

### 🚀 New Features
- **Smart Health Check Filtering**: Automatically ignore common health check endpoints from New Relic tracking
  - Auto-ignores: `/health`, `/healthcheck`, `/ping`, `/status`, and root `/`
  - Configurable via `observabilityMiddleware()` options
  - Prevents unnecessary data being sent to New Relic instances
  - Zero breaking changes - backward compatible

### 📝 Changes
- Updated `src/instrumentation.ts`:
  - Added `ObservabilityMiddlewareOptions` interface
  - Added `ignoreHealthChecks` option (default: `true`)
  - Added `ignorePaths` option for custom patterns
  - Smart path matching logic (exact match, query params, RegExp support)
- Updated `src/index.ts` - Export `ObservabilityMiddlewareOptions` type
- Updated `README.md` - Added comprehensive configuration examples
- Updated `package.json` - Version bumped to 7.1.0

### 🎯 Benefits
- Reduces New Relic costs by filtering out health check noise
- Improves data quality in New Relic dashboards
- Minimal code changes required in projects (just upgrade package)
- Flexible configuration for custom use cases

### 📚 Documentation
- Added health check filtering examples in README
- Updated middleware API documentation
- Added configuration options guide

---

## [2.1.0] - 2025-10-29

### 🚀 New Features
- **Axios Distributed Tracing**: Automatically propagate New Relic distributed tracing headers on all outbound HTTP requests
  - Works with global axios instance
  - Works with custom axios instances
  - Automatically enabled when `initializeObservability()` is called
  - Gracefully handles cases where axios is not installed

### 📝 Changes
- Added `src/axios-tracing.ts` - New module for HTTP client distributed tracing
- Updated `src/instrumentation.ts` - Automatically initializes axios tracing
- Updated `package.json`:
  - Version bumped to 2.1.0
  - Added `axios` as optional peer dependency
  - Added `distributed-tracing` keyword
- Updated `README.md` - Added comprehensive axios documentation

### 🔧 Technical Details
- Axios is now an optional peer dependency (package works without it)
- Uses dynamic require to avoid hard dependency on axios
- Interceptor is added only once (prevents duplicate initialization)
- Fails silently if New Relic is unavailable (doesn't break HTTP requests)

### 📚 Documentation
- Added detailed axios usage examples in README
- Updated API documentation
- Added notes about automatic initialization

---

## [2.0.0] - Previous Release
- MongoDB command tracing
- Express middleware
- Observability service
- Data scrubbing utilities

