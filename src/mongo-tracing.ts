/**
 * MongoDB Native Driver Command Monitoring
 * 
 * This module instruments the MongoDB native driver using its official monitoring API.
 * It tracks all database commands (find, insert, update, delete, aggregate, etc.)
 * and adds detailed attributes to New Relic spans.
 * 
 * Works with both direct MongoDB usage and Mongoose (since Mongoose uses MongoDB driver underneath).
 */
import { MongoClient } from 'mongodb'
import { createObservabilityService } from './observability.service.factory'

const observabilityService = createObservabilityService()

let isInstalled = false
let mongoClientGetter: (() => MongoClient | null) | null = null

// Store command metadata by requestId for tracking command lifecycle
const commandTracking = new Map<number, {
  startTime: number
  commandName: string
  databaseName: string
  collection: string
  preview: any
}>()

/**
 * Register MongoDB client for tracing
 * This should be called once after MongoDB connection is established
 */
export function registerMongoClient(getClient: () => MongoClient | null): void {
  mongoClientGetter = getClient
  setupMonitoring()
}

/**
 * Install MongoDB command monitoring listeners
 * This uses MongoDB's official monitoring API which is much more reliable than patching
 * 
 * Reference: https://mongodb.github.io/node-mongodb-native/4.0/classes/MongoClient.html#on
 */
function setupMonitoring(): void {
  if (isInstalled) return
  
  try {
    // Get the MongoDB client from the registered getter function
    const client = mongoClientGetter?.()
    
    if (!client) {
      // Client not ready yet, will be called again when registered
      return
    }
    
    isInstalled = true

      // Listen for command started events
      client.on('commandStarted', (event: any) => {
        try {
          const { commandName, databaseName, requestId } = event
          const command = event.command || {}

          // Build a safe preview of the command
          const commandPreview = buildCommandPreview(commandName, command)

          // Store command start time for duration calculation
          commandTracking.set(requestId, {
            startTime: Date.now(),
            commandName,
            databaseName,
            collection: command.collection || command[commandName] || 'unknown',
            preview: commandPreview,
          })
        } catch (error) {
          // Don't let monitoring errors break the application
        }
      })

      // Listen for command succeeded events
      client.on('commandSucceeded', (event: any) => {
        try {
          const { commandName, requestId, duration } = event
          const cmdData = commandTracking.get(requestId)

          if (cmdData) {
            // Add custom span attributes for this operation
            observabilityService.addCustomSpanAttributes({
              'db.system': 'mongodb',
              'db.name': cmdData.databaseName,
              'db.collection': cmdData.collection,
              'db.operation': commandName,
              'db.statement.preview': JSON.stringify(cmdData.preview),
              'db.duration.ms': duration,
              'db.success': true,
            })

            // Clean up stored data
            commandTracking.delete(requestId)
          }
        } catch (error) {
          // Don't let monitoring errors break the application
        }
      })

      // Listen for command failed events
      client.on('commandFailed', (event: any) => {
        try {
          const { commandName, requestId, failure, duration } = event
          const cmdData = commandTracking.get(requestId)

          if (cmdData) {
            // Add custom span attributes for this failed operation
            observabilityService.addCustomSpanAttributes({
              'db.system': 'mongodb',
              'db.name': cmdData.databaseName,
              'db.collection': cmdData.collection,
              'db.operation': commandName,
              'db.statement.preview': JSON.stringify(cmdData.preview),
              'db.duration.ms': duration,
              'db.success': false,
              'db.error': String(failure?.message || failure),
            })

            // Report error to New Relic
            if (failure instanceof Error) {
              observabilityService.noticeError(failure)
            }

            // Clean up stored data
            commandTracking.delete(requestId)
          }
        } catch (error) {
          // Don't let monitoring errors break the application
        }
      })
  } catch (error) {
    // Failed to setup MongoDB monitoring - fail silently
  }
}

/**
 * Build a preview of the MongoDB command
 * Only shows filter/query information, not data being inserted or updated
 */
function buildCommandPreview(commandName: string, command: any): any {
  try {
    // Extract filter/query for all command types
    const filter = 
      command.filter ||
      command.query ||
      command.updates?.[0]?.q ||
      command.q ||
      command.deletes?.[0]?.q

    // For aggregate, show pipeline stages overview
    if (commandName === 'aggregate' && Array.isArray(command.pipeline)) {
      return {
        filter: filter,
        pipelineStages: command.pipeline.map((stage: any) => Object.keys(stage)[0]).join(' → '),
      }
    }

    // For all other commands, just show the filter if available
    if (filter) {
      return {
        filter: filter,
      }
    }

    // If no filter available, return minimal info
    return {
      command: commandName,
      collection: command.collection || command[commandName],
    }
  } catch (error) {
    return { command: commandName, error: 'Failed to build preview' }
  }
}

