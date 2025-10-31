// Core exports
export {
  initializeObservability,
  observabilityMiddleware,
  observabilityService,
  registerMongoClient,
} from './instrumentation'

// Service exports
export type { ObservabilityService } from './observability.service.factory'
export { createObservabilityService } from './observability.service.factory'

// Utilities
export { scrub } from './scrub'
