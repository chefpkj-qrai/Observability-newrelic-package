# @yourorg/observability-newrelic

Generic observability instrumentation for Node.js applications using New Relic.

## Features

- 🔍 Automatic MongoDB command tracing
- 📊 Express middleware for request tracking
- 🌐 Axios distributed tracing for HTTP clients
- 🛡️ Data scrubbing for sensitive information
- 🎯 Type-safe TypeScript API
- 🔌 Pluggable architecture

## Installation

```bash
npm install @yourorg/observability-newrelic
```

## Prerequisites

- `newrelic` package installed and configured
- MongoDB 6.x or higher (optional - only if using MongoDB tracing)
- Axios 1.x or higher (optional - only if using HTTP client tracing)

## Quick Start

```typescript
import 'newrelic' // Must be first!
import { initializeObservability, observabilityMiddleware } from '@yourorg/observability-newrelic'
import express from 'express'
import axios from 'axios'

// Initialize observability (this sets up axios, MongoDB, and other instrumentation)
initializeObservability()

const app = express()

// Add observability middleware (first middleware!)
app.use(observabilityMiddleware())

// Your routes...
app.get('/api/users', async (req, res) => {
  // Axios calls now automatically propagate distributed tracing headers
  const response = await axios.get('https://downstream-service.com/users')
  res.json(response.data)
})

app.listen(3000)
```

## Axios Distributed Tracing

Axios distributed tracing is **automatically enabled** when you call `initializeObservability()`. If axios is installed in your project, the package will automatically add an interceptor to propagate New Relic distributed tracing headers on all outbound HTTP requests.

```typescript
import 'newrelic'
import { initializeObservability } from '@yourorg/observability-newrelic'
import axios from 'axios'

// Initialize (automatically sets up axios interceptor)
initializeObservability()

// All axios calls now propagate distributed tracing headers automatically
await axios.get('https://api.example.com/data')
await axios.post('https://api.example.com/users', { name: 'John' })

// Works with axios instances too
const client = axios.create({ baseURL: 'https://api.example.com' })
await client.get('/users') // Headers are automatically added
```

**What it does:**
- Automatically adds New Relic distributed tracing headers (`newrelic`, `traceparent`, `tracestate`) to every axios request
- Enables end-to-end tracing across microservices
- Works with global axios and custom axios instances
- Gracefully handles cases where New Relic is not available

**No configuration needed** - it just works! ✨

## MongoDB Tracing

To enable MongoDB tracing, register your client after connection:

```typescript
import { registerMongoClient } from '@yourorg/observability-newrelic'

// In your MongoDB connection class
registerMongoClient(() => yourMongoClient)
```

## API Documentation

### `initializeObservability()`
Initializes all observability instrumentation. Call once at application startup.

This automatically sets up:
- Axios distributed tracing (if axios is installed)
- MongoDB command monitoring (when `registerMongoClient` is called)
- Express request tracking (when `observabilityMiddleware` is used)

### `observabilityMiddleware()`
Express middleware that tracks HTTP requests. Add as first middleware.

### `registerMongoClient(getClient: () => MongoClient | null)`
Registers MongoDB client for command tracing.

### `observabilityService`
Service instance for adding custom attributes and tracking errors.

```typescript
import { observabilityService } from '@yourorg/observability-newrelic'

// Add custom attributes
observabilityService.addCustomAttributes({
  'user.id': userId,
  'tenant.id': tenantId
})

// Track errors
observabilityService.noticeError(error)
```

## License

MIT
