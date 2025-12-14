/**
 * Generic Observability Instrumentation
 * 
 * This file contains generic, reusable observability code that can be extracted
 * into an npm package. All code here should be framework-agnostic and not contain
 * business-specific logic.
 * 
 * For project-specific tracking logic, see: request-metadata.helper.ts
 */
import { initializeAxiosTracing } from './axios-tracing'
import { initializeAxiosExternalTracing } from './axios-external-tracing'
import { registerMongoClient } from './mongo-tracing'
import { createObservabilityService } from './observability.service.factory'
import newrelic from 'newrelic'

const observabilityService = createObservabilityService()

/**
 * Get New Relic trace ID for the current transaction
 * Trace ID is shared across all services in a distributed trace
 * 
 * @returns {string} The trace ID, or empty string if not available
 * 
 * @example
 * ```typescript
 * import { getNewRelicTraceId } from '@lib/observability'
 * 
 * const traceId = getNewRelicTraceId()
 * console.log('Current trace ID:', traceId)
 * ```
 */
export function getNewRelicTraceId(): string {
  try {
    const traceMetadata = newrelic.getTraceMetadata()
    if (traceMetadata && traceMetadata.traceId) {
      return traceMetadata.traceId
    }
  } catch (error) {
    // getTraceMetadata might not be available or fail - return empty string
  }
  return ''
}

/**
 * Get New Relic transaction ID (span ID) for the current service's transaction
 * This is unique to the current service, not the parent transaction
 * 
 * @returns {string} The transaction ID (span ID), or empty string if not available
 * 
 * @example
 * ```typescript
 * import { getNewRelicTransactionId } from '@lib/observability'
 * 
 * const transactionId = getNewRelicTransactionId()
 * console.log('Current transaction ID:', transactionId)
 * ```
 */
export function getNewRelicTransactionId(): string {
  try {
    const traceMetadata = newrelic.getTraceMetadata()
    if (traceMetadata && traceMetadata.spanId) {
      return traceMetadata.spanId
    }
  } catch (error) {
    // getTraceMetadata might not be available or fail - return empty string
  }
  return ''
}

/**
 * Get both New Relic trace ID and transaction ID in a single call
 * 
 * @returns {{ traceId: string, transactionId: string }} Object containing trace ID and transaction ID
 * 
 * @example
 * ```typescript
 * import { getNewRelicIds } from '@lib/observability'
 * 
 * const { traceId, transactionId } = getNewRelicIds()
 * console.log('Trace ID:', traceId)
 * console.log('Transaction ID:', transactionId)
 * ```
 */
export function getNewRelicIds(): { traceId: string; transactionId: string } {
  try {
    const traceMetadata = newrelic.getTraceMetadata()
    if (traceMetadata) {
      return {
        traceId: traceMetadata.traceId || '',
        transactionId: traceMetadata.spanId || '',
      }
    }
  } catch (error) {
    // getTraceMetadata might not be available or fail - return empty strings
  }
  return { traceId: '', transactionId: '' }
}

/**
 * Initialize all observability instrumentation
 * Call this ONCE at application startup, before any other code
 * 
 * This function sets up:
 * - Axios tracing (basic or enhanced based on options)
 * - MongoDB command monitoring (when registerMongoClient is called)
 * - Express middleware (when observabilityMiddleware is used)
 * 
 * @param options Configuration options
 * @param options.enhancedAxiosTracking - If true, enables full axios external call tracking with metrics (URL, status, duration)
 *                                         If false (default), only adds distributed tracing headers
 * 
 * @example
 * ```typescript
 * import 'newrelic'
 * import { initializeObservability } from '@lib/observability'
 * 
 * // Basic axios tracing (distributed tracing headers only)
 * initializeObservability()
 * 
 * // Enhanced axios tracing (with full external call metrics)
 * initializeObservability({ enhancedAxiosTracking: true })
 * ```
 */
export function initializeObservability(options?: { enhancedAxiosTracking?: boolean }): void {
  // Initialize axios tracing based on options
  if (options?.enhancedAxiosTracking) {
    // Enhanced: Full external call tracking with metrics
    initializeAxiosExternalTracing()
  } else {
    // Basic: Only distributed tracing headers (backward compatible)
    initializeAxiosTracing()
  }
}

// Export the mongo registration function for internal use
export { registerMongoClient }

/**
 * Generic Express middleware to track ALL incoming requests
 * Add this as the FIRST middleware in your app
 * 
 * This middleware is generic and framework-agnostic. It captures basic HTTP
 * request metadata that is common across all web applications.
 * 
 * For business-specific tracking (e.g., broadcast IDs, template IDs),
 * use the project-specific helper: trackRequestMetadata()
 * 
 * @example
 * ```typescript
 * import { observabilityMiddleware } from '@lib/observability'
 * 
 * const app = express()
 * app.use(observabilityMiddleware()) // First middleware
 * ```
 */
export function observabilityMiddleware() {
  return (req: any, res: any, next: any) => {
    try {

      // // Check for broadcast-processor send-message route
      // const broadcastProcessorPattern = /^\/api\/v4\/broadcast-processor\/[^\/]+\/send-message/
      // if(broadcastProcessorPattern.test(req.url)) {
      //   console.log('pkj_main_req', req)
      //   console.log('pkj_main_req_ctx', req.ctx?.id)
      //   console.log('pkj_main_req_headers', req.headers)
      // }

      // Extract request ID with fallback chain:
      // 1. req.reqId (set by service-specific middleware like whatsapp-service)
      // 2. req.ctx?.id (set by context middleware)
      // 3. req.headers['x-request-id'] (passed from upstream services)
      // This ensures backward compatibility while supporting per-service traceIds
      const qrTraceId: string | undefined = req.reqId?.toString() || req.ctx?.id || req.headers['x-request-id']

      const attributes: Record<string, any> = {
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.route': (req.route && req.route.path) || req.path,
        'qrTraceId': qrTraceId,
        'user.agent': req.headers['user-agent'],
      }

      // // Extract New Relic trace ID and set it on the request object
      // try {
      //   const newrelicTraceId = getNewRelicTraceId()
      //   if (newrelicTraceId) {
      //     // Set on request object for use in other middleware/handlers
      //     req.newrelicTraceId = newrelicTraceId
      //   }
      // } catch (error) {
      //   // Failed to extract New Relic IDs - fail silently
      // }

      // Add all attributes at once
      observabilityService.addCustomAttributes(attributes)

      // Set transaction name based on route
      const routeName = `${req.method} ${(req.route && req.route.path) || req.path}`
      observabilityService.setTransactionName(routeName)
    } catch (error) {
      // Error in observability middleware - fail silently
    }
    next()
  }
}

export { observabilityService }

