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

// Service exports
export type { ObservabilityService } from './observability.service.factory'
export { createObservabilityService } from './observability.service.factory'
