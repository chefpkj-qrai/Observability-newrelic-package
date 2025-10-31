/**
 * Axios HTTP Client Distributed Tracing
 * 
 * This module automatically instruments axios to propagate distributed tracing headers
 * on all outbound HTTP requests. This enables end-to-end tracing across microservices.
 * 
 * The interceptor adds New Relic distributed tracing headers to every axios request,
 * allowing you to trace requests as they flow through your system.
 */
import { createObservabilityService } from './observability.service.factory'

const observabilityService = createObservabilityService()

let axiosTracingInitialized = false

/**
 * Initialize axios distributed tracing
 * 
 * Adds a request interceptor to axios that automatically propagates
 * distributed tracing headers to downstream services.
 * 
 * This function is safe to call multiple times - it will only install
 * the interceptor once.
 * 
 * @example
 * ```typescript
 * import { initializeAxiosTracing } from 'awesome-instrumentation-core'
 * 
 * // Initialize once at startup
 * initializeAxiosTracing()
 * 
 * // All axios calls now automatically propagate tracing headers
 * await axios.get('https://api.example.com/users')
 * ```
 */
export function initializeAxiosTracing(): void {
  if (axiosTracingInitialized) {
    return // Prevent duplicate initialization
  }

  try {
    // Dynamically import axios to make it optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const axios = require('axios')

    // Add request interceptor for distributed tracing
    axios.interceptors.request.use((config: any) => {
      try {
        const tx = observabilityService.getTransaction?.()
        
        // New Relic Node agent exposes insertDistributedTraceHeaders on the transaction
        // This adds the necessary headers (newrelic, traceparent, tracestate) for distributed tracing
        if (tx && typeof tx.insertDistributedTraceHeaders === 'function') {
          config.headers = config.headers || {}
          tx.insertDistributedTraceHeaders(config.headers as Record<string, string>)
        }
      } catch (error) {
        // Fail silently - don't break HTTP requests if observability fails
        // This ensures your app continues working even if New Relic is unavailable
      }
      return config
    })

    axiosTracingInitialized = true
    console.log('✅ Axios distributed tracing initialized')
  } catch (error) {
    // Axios is not installed or not available - this is OK
    // The package can work without axios for projects that don't use it
    console.log('⚠️  Axios not found - skipping axios tracing (this is OK if you don\'t use axios)')
  }
}

/**
 * Check if axios tracing has been initialized
 * Useful for testing or conditional initialization
 */
export function isAxiosTracingInitialized(): boolean {
  return axiosTracingInitialized
}

