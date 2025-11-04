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
import { registerMongoClient } from './mongo-tracing'
import { createObservabilityService } from './observability.service.factory'

const observabilityService = createObservabilityService()

// Store the qrTraceId generator function
let qrTraceIdGenerator: ((req: any) => string) | null = null

/**
 * Initialize all observability instrumentation
 * Call this ONCE at application startup, before any other code
 * 
 * This function sets up:
 * - Axios distributed tracing (if axios is installed)
 * - MongoDB command monitoring (when registerMongoClient is called)
 * - Express middleware (when observabilityMiddleware is used)
 * 
 * @param options - Configuration options
 * @param options.getQrTraceId - Function to generate qrTraceId from request
 * 
 * @example
 * ```typescript
 * import 'newrelic'
 * import { initializeObservability } from '@lib/observability'
 * 
 * initializeObservability({
 *   getQrTraceId: (req) => req.ctx.toString()
 * })
 * ```
 */
export function initializeObservability(options?: { getQrTraceId?: (req: any) => string }): void {
  // Store the qrTraceId generator if provided
  if (options?.getQrTraceId) {
    qrTraceIdGenerator = options.getQrTraceId
  }
  
  // Initialize axios distributed tracing (optional - safe if axios not installed)
  initializeAxiosTracing()
}

/**
 * Get the stored qrTraceId generator function
 * @internal
 */
export function getQrTraceIdGenerator(): ((req: any) => string) | null {
  return qrTraceIdGenerator
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
      const attributes: Record<string, any> = {
        'http.method': req.method,
        'http.url': req.url,
        'http.path': req.path,
        'http.route': (req.route && req.route.path) || req.path,
        'request.id': req.headers['x-request-id'],
        'user.agent': req.headers['user-agent'],
      }

      // Handle qrTraceId for distributed tracing
      let qrTraceId: string | undefined
      
      // First, check if qrTraceId is in incoming headers (from upstream service)
      if (req.headers['x-request-id']) {
        qrTraceId = req.headers['x-request-id']
      } 
      // If not in headers, generate new one if generator is provided
      else if (qrTraceIdGenerator) {
        try {
          qrTraceId = qrTraceIdGenerator(req)
        } catch (error) {
          // Failed to generate qrTraceId - continue without it
        }
      }

      // Store qrTraceId on request for downstream propagation
      if (qrTraceId) {
        req.qrTraceId = qrTraceId
        attributes.qrTraceId = qrTraceId
      }

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

