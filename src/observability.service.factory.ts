import newrelic from 'newrelic'

export interface ObservabilityService {
  addCustomAttributes(attributes: Record<string, any>): void
  setTransactionName(name: string): void
  addCustomSpanAttributes(attributes: Record<string, any>): void
  startSegment<T>(name: string, record: boolean, handler: () => T): T
  getTransaction(): any
  startBackgroundTransaction<T>(name: string, handler: () => Promise<T>): Promise<T>
  noticeError(error: Error): void
  trackRequestMetadata(req: any, customRequest: any): void
}

class NewRelicObservabilityService implements ObservabilityService {
  addCustomAttributes(attributes: Record<string, any>): void {
    try {
      if (!newrelic || typeof newrelic.addCustomAttributes !== 'function') {
        return
      }
      
      newrelic.addCustomAttributes(attributes)
    } catch (error) {
      // Failed to add custom attributes - fail silently
    }
  }

  setTransactionName(name: string): void {
    try {
      newrelic.setTransactionName(name)
    } catch (error) {
      // Failed to set New Relic transaction name - fail silently
    }
  }

  addCustomSpanAttributes(attributes: Record<string, any>): void {
    try {
      newrelic.addCustomSpanAttributes(attributes)
    } catch (error) {
      // Failed to add New Relic span attributes - fail silently
    }
  }

  startSegment<T>(name: string, record: boolean, handler: () => T): T {
    return newrelic.startSegment(name, record, handler)
  }

  getTransaction(): any {
    return newrelic.getTransaction()
  }

  startBackgroundTransaction<T>(name: string, handler: () => Promise<T>): Promise<T> {
    return newrelic.startBackgroundTransaction(name, handler)
  }

  noticeError(error: Error): void {
    try {
      newrelic.noticeError(error)
    } catch (error) {
      // console.error('Failed to notice error in New Relic:', error)
    }
  }

  trackRequestMetadata(req: any, customRequest: any): void {
    try {
      const body = customRequest.body || {}
      const { to } = body
      let toCount = 0
      
      if (Array.isArray(to)) {
        toCount = to.length
      } else if (to && (typeof to === 'string' || to.phone)) {
        toCount = 1
      }

      this.addCustomAttributes({
        company_id: customRequest.company || 'unknown',
        broadcast_id: customRequest.params?.broadcastId,
        template_id: body.templateId,
        to_count: toCount,
        http_method: req.method,
        http_route: (req.route && req.route.path) || req.path,
      })
      
      // Set transaction name for specific routes
      if (
        req.method === 'POST' &&
        (req.route?.path === '/:broadcastId/send-message' || req.path.endsWith('/send-message'))
      ) {
        this.setTransactionName('broadcast.sendMessage.me')
      }
    } catch (error) {
      // console.error('Error tracking request metadata:', error)
    }
  }
}

let observabilityServiceInstance: ObservabilityService | null = null

export function createObservabilityService(): ObservabilityService {
  if (!observabilityServiceInstance) {
    observabilityServiceInstance = new NewRelicObservabilityService()
  }
  return observabilityServiceInstance
}
