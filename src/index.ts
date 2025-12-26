// Core exports
export {
  initializeObservability,
  observabilityMiddleware,
  observabilityService,
  registerMongoClient,
  getNewRelicTraceId,
  getNewRelicTransactionId,
  getNewRelicIds,
} from './instrumentation'

// Type exports
export type { ObservabilityMiddlewareOptions } from './instrumentation'

// Service exports
export type { ObservabilityService } from './observability.service.factory'
export { createObservabilityService } from './observability.service.factory'

// HTTP Client Tracing exports
export {
  trackedFetch,
  getExternalCallsForCurrentTransaction,
  clearExternalCallsMap,
  clearNodeFetchCleanupInterval
} from './node-fetch-tracing'

// Axios Enhanced External Tracing exports
export {
  initializeAxiosExternalTracing,
  isAxiosExternalTracingInitialized,
  getAxiosExternalCallsForCurrentTransaction,
  clearAxiosExternalCallsMap,
  clearAxiosExternalCleanupInterval
} from './axios-external-tracing'

// Axios Basic Tracing exports (for backward compatibility)
export {
  initializeAxiosTracing,
  isAxiosTracingInitialized
} from './axios-tracing'
