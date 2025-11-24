/**
 * Axios HTTP Client External Call Tracking
 * 
 * This module provides ENHANCED axios instrumentation that:
 * 1. Propagates distributed tracing headers (like basic axios-tracing)
 * 2. Tracks all external API calls with detailed metrics (URL, method, status, duration)
 * 3. Creates external segments in New Relic for visibility
 * 4. Saves call metrics as custom attributes for each transaction
 * 5. Captures both successful and failed requests
 * 
 * Use this when you want full visibility into external API calls.
 * Use basic axios-tracing if you only need distributed tracing headers.
 */
import { createObservabilityService } from './observability.service.factory'

const observabilityService = createObservabilityService()

let axiosExternalTracingInitialized = false

interface ExternalCallData {
  url: string
  method: string
  statusCode: number
  duration: number
  success: boolean
  error?: string
}

interface TransactionCallData {
  calls: ExternalCallData[]
  lastAccess: number
  lastSavedIndex: number
}

// Store external calls per transaction
const externalCallsMap = new Map<string, TransactionCallData>()

// Periodic cleanup of old transaction data (runs every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now()
  const fiveMinutesAgo = now - 5 * 60 * 1000

  for (const [txId, data] of externalCallsMap.entries()) {
    if (data.lastAccess < fiveMinutesAgo) {
      externalCallsMap.delete(txId)
    }
  }
}, 5 * 60 * 1000)

// Allow cleanup interval to be cleared if needed
export function clearAxiosExternalCleanupInterval(): void {
  clearInterval(cleanupInterval)
}

/**
 * Get or create external calls array for current transaction
 */
function getTransactionCalls(): ExternalCallData[] {
  try {
    const transaction = observabilityService.getTransaction()
    if (!transaction) return []

    const txId = transaction.id
    if (!externalCallsMap.has(txId)) {
      externalCallsMap.set(txId, {
        calls: [],
        lastAccess: Date.now(),
        lastSavedIndex: -1
      })
    }

    const data = externalCallsMap.get(txId)
    if (data) {
      data.lastAccess = Date.now()
      return data.calls
    }
    return []
  } catch {
    return []
  }
}

/**
 * Save only NEW external calls to New Relic as custom attributes
 */
function saveExternalCalls(calls: ExternalCallData[]): void {
  if (calls.length === 0) return

  try {
    const transaction = observabilityService.getTransaction()
    if (!transaction) return

    const txId = transaction.id
    const data = externalCallsMap.get(txId)
    if (!data) return

    const lastSavedIndex = data.lastSavedIndex

    // Only add attributes for NEW calls
    for (let i = lastSavedIndex + 1; i < calls.length; i++) {
      const call = calls[i]
      const prefix = `externalCall.${i + 1}`

      observabilityService.addCustomAttributes({
        [`${prefix}.url`]: call.url,
        [`${prefix}.method`]: call.method,
        [`${prefix}.statusCode`]: call.statusCode,
        [`${prefix}.duration`]: call.duration,
        [`${prefix}.success`]: call.success,
        ...(call.error && { [`${prefix}.error`]: call.error })
      })
    }

    // Update last saved index
    data.lastSavedIndex = calls.length - 1
  } catch {
    // Fail silently
  }
}

/**
 * Initialize axios external call tracking with full metrics
 * 
 * This adds both request and response interceptors to axios that:
 * - Propagate distributed tracing headers
 * - Track request timing
 * - Capture response status codes
 * - Create external segments in New Relic
 * - Save detailed metrics as custom attributes
 * 
 * This function is safe to call multiple times - it will only install
 * the interceptors once.
 * 
 * @example
 * ```typescript
 * import { initializeAxiosExternalTracing } from 'awesome-instrumentation-core'
 * 
 * // Initialize once at startup
 * initializeAxiosExternalTracing()
 * 
 * // All axios calls now automatically tracked with full metrics
 * const res = await axios.get('https://api.example.com/users')
 * // New Relic will show: URL, method, status code, duration, etc.
 * ```
 */
export function initializeAxiosExternalTracing(): void {
  if (axiosExternalTracingInitialized) {
    return // Prevent duplicate initialization
  }

  try {
    // Dynamically import axios to make it optional
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const axios = require('axios')

    // Add request interceptor for distributed tracing and timing
    axios.interceptors.request.use((config: any) => {
      try {
        const tx = observabilityService.getTransaction?.()
        
        // Add distributed tracing headers
        if (tx && typeof tx.insertDistributedTraceHeaders === 'function') {
          config.headers = config.headers || {}
          tx.insertDistributedTraceHeaders(config.headers as Record<string, string>)
        }

        // Store request start time for duration calculation
        config.metadata = config.metadata || {}
        config.metadata.startTime = Date.now()
      } catch (error) {
        // Fail silently - don't break HTTP requests if observability fails
      }
      return config
    })

    // Add response interceptor to capture metrics
    axios.interceptors.response.use(
      (response: any) => {
        try {
          captureAxiosCall(response.config, response.status, null)
        } catch {
          // Fail silently
        }
        return response
      },
      (error: any) => {
        try {
          const statusCode = error.response?.status || 0
          const errorMessage = error.message || 'Unknown error'
          captureAxiosCall(error.config, statusCode, errorMessage)
        } catch {
          // Fail silently
        }
        return Promise.reject(error)
      }
    )

    axiosExternalTracingInitialized = true
  } catch (error) {
    // Axios is not installed or not available - this is OK
    // The package can work without axios for projects that don't use it
  }
}

/**
 * Capture axios call metrics and save to New Relic
 */
function captureAxiosCall(config: any, statusCode: number, errorMessage: string | null): void {
  try {
    const startTime = config.metadata?.startTime || Date.now()
    const duration = Date.now() - startTime
    const url = config.url || 'unknown'
    const method = (config.method || 'GET').toUpperCase()

    // Parse URL to get hostname for external segment
    let hostname = 'unknown'
    try {
      const urlObj = new URL(url)
      hostname = urlObj.hostname
    } catch {
      // If URL parsing fails, use the URL as-is
    }

    // Create external segment in New Relic for this call
    const transaction = observabilityService.getTransaction()
    if (transaction && typeof transaction.startExternalSegment === 'function') {
      // The external segment appears in New Relic's External Services view
      const segment = transaction.startExternalSegment({
        host: hostname,
        procedure: method,
        url: url
      })
      
      if (segment && typeof segment.end === 'function') {
        segment.end()
      }
    }

    // Store call data
    const calls = getTransactionCalls()
    const callData: ExternalCallData = {
      url,
      method,
      statusCode,
      duration,
      success: statusCode >= 200 && statusCode < 400,
      ...(errorMessage && { error: errorMessage })
    }
    
    calls.push(callData)
    saveExternalCalls(calls)
  } catch {
    // Fail silently
  }
}

/**
 * Check if axios external tracing has been initialized
 * Useful for testing or conditional initialization
 */
export function isAxiosExternalTracingInitialized(): boolean {
  return axiosExternalTracingInitialized
}

/**
 * Get all external calls for the current transaction
 * Useful for debugging or custom reporting
 */
export function getAxiosExternalCallsForCurrentTransaction(): ExternalCallData[] {
  return getTransactionCalls()
}

/**
 * Clear the external calls map
 * Useful for testing
 */
export function clearAxiosExternalCallsMap(): void {
  externalCallsMap.clear()
}

