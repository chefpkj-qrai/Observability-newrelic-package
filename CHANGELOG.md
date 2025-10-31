# Changelog

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

