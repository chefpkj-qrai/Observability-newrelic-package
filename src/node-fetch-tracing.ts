/**
 * Node-Fetch HTTP Client Tracing and Tracking
 * 
 * This module provides a tracked wrapper for node-fetch that:
 * 1. Automatically tracks all external API calls with detailed metrics
 * 2. Stores call data per transaction (URL, method, status, duration, etc.)
 * 3. Saves metrics to New Relic as custom attributes
 * 4. Handles both successful and failed requests
 * 5. Automatically cleans up old transaction data
 * 
 * Use `trackedFetch` instead of regular `fetch` to automatically track
 * external API calls in your New Relic transactions.
 */
import { createObservabilityService } from './observability.service.factory'

const observabilityService = createObservabilityService()

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

// Allow cleanup interval to be cleared if needed (useful for testing or shutdown)
export function clearNodeFetchCleanupInterval(): void {
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
      data.lastAccess = Date.now() // Update last access time
      return data.calls
    }
    return []
  } catch {
    return []
  }
}

/**
 * Save only NEW external calls to New Relic as custom attributes
 * Only adds attributes for calls that haven't been saved yet
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

    // Only add attributes for NEW calls (those added since last save)
    for (let i = lastSavedIndex + 1; i < calls.length; i++) {
      const call = calls[i]
      const prefix = `external.${i + 1}`
      const attributes: Record<string, string | number | boolean> = {
        [`${prefix}.url`]: call.url,
        [`${prefix}.method`]: call.method,
        [`${prefix}.statusCode`]: call.statusCode,
        [`${prefix}.duration.ms`]: call.duration,
        [`${prefix}.success`]: call.success
      }

      // Add error reason if call failed
      if (!call.success && call.error) {
        attributes[`${prefix}.error`] = call.error
      }

      observabilityService.addCustomAttributes(attributes)
    }

    // Update the summary attributes (these get overwritten with latest values)
    observabilityService.addCustomAttributes({
      'external.callCount': calls.length,
      'external.totalDuration.ms': calls.reduce(
        (sum, call) => sum + call.duration,
        0
      ),
      'external.failedCount': calls.filter((call) => !call.success).length
    })

    // Update the last saved index
    data.lastSavedIndex = calls.length - 1
  } catch (error) {
    // Fail silently - don't break HTTP requests if observability fails
  }
}

/**
 * Wrapper for fetch calls that tracks all external API calls
 * 
 * This function wraps node-fetch to automatically track external API calls
 * and send detailed metrics to New Relic. It captures:
 * - Request URL and method
 * - Response status code
 * - Request duration
 * - Success/failure status
 * - Error messages for failed requests
 * 
 * All tracked calls are stored per transaction and sent to New Relic
 * as custom attributes, allowing you to analyze external API usage
 * in your New Relic dashboards.
 * 
 * @example
 * ```typescript
 * import { trackedFetch } from 'awesome-instrumentation-core'
 * 
 * // Use exactly like regular fetch
 * const response = await trackedFetch('https://api.example.com/users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'John' })
 * })
 * 
 * // All calls in a transaction are automatically tracked and reported
 * ```
 * 
 * @param url - The URL to fetch (string or URL object)
 * @param options - Optional fetch options (method, headers, body, etc.)
 * @returns Promise<Response> - The fetch response
 * @throws Re-throws any errors after tracking them
 */
export async function trackedFetch(
  url: string | URL,
  options?: RequestInit
): Promise<Response> {
  // Dynamically import node-fetch to make it optional
  let fetch: any
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    fetch = require('node-fetch')
  } catch (error) {
    throw new Error(
      'node-fetch is not installed. Please install it to use trackedFetch: npm install node-fetch'
    )
  }

  const urlString = url.toString()
  const method = (options?.method as string) || 'GET'
  const startTime = Date.now()

  try {
    const response = await fetch(url, options)
    const duration = Date.now() - startTime

    // Prepare call data
    const callData: ExternalCallData = {
      url: urlString,
      method,
      statusCode: response.status,
      duration,
      success: response.ok
    }

    // For non-2xx responses, capture status text as error reason
    if (!response.ok) {
      callData.error = `HTTP ${response.status} ${
        response.statusText || 'Error'
      }`
    }

    // Add to transaction's call list
    const calls = getTransactionCalls()
    calls.push(callData)

    // Save all calls (will be updated with each call)
    saveExternalCalls(calls)

    return response
  } catch (error) {
    const duration = Date.now() - startTime

    // Prepare failed call data
    const callData: ExternalCallData = {
      url: urlString,
      method,
      statusCode: 0,
      duration,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }

    // Add failed call to transaction's list
    const calls = getTransactionCalls()
    calls.push(callData)

    // Save all calls
    saveExternalCalls(calls)

    observabilityService.noticeError(error as Error)
    throw error
  }
}

/**
 * Get the current transaction's external call data (useful for testing/debugging)
 */
export function getExternalCallsForCurrentTransaction(): ExternalCallData[] {
  return getTransactionCalls()
}

/**
 * Clear all tracked external calls (useful for testing)
 */
export function clearExternalCallsMap(): void {
  externalCallsMap.clear()
}

