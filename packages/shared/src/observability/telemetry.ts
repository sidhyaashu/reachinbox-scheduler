import * as appInsights from 'applicationinsights';

let isTelemetryInitialized = false;

/**
 * Initializes Microsoft Azure Application Insights telemetry.
 * Safe to call in any service or environment; if APPLICATIONINSIGHTS_CONNECTION_STRING
 * is not configured, it gracefully skips without errors.
 */
export function initTelemetry(serviceName: string): boolean {
  if (isTelemetryInitialized) {
    return true;
  }

  const connectionString =
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING ||
    process.env.APPINSIGHTS_CONNECTIONSTRING;

  if (!connectionString) {
    return false;
  }

  try {
    // 1. Set OpenTelemetry & Azure Application Insights standard role variables
    process.env.OTEL_SERVICE_NAME = serviceName;
    process.env.APPLICATIONINSIGHTS_ROLE_NAME = serviceName;
    process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${serviceName},service.version=1.0.0,deployment.environment=${process.env.NODE_ENV || 'production'}`;

    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C);

    appInsights.start();

    // 2. Set Cloud Role Name & Instance on defaultClient context
    if (appInsights.defaultClient) {
      const client = appInsights.defaultClient;
      const roleKey = client.context?.keys?.cloudRole || 'ai.cloud.role';
      const roleInstanceKey = client.context?.keys?.cloudRoleInstance || 'ai.cloud.roleInstance';
      const appVerKey = client.context?.keys?.applicationVersion || 'ai.application.ver';

      if (client.context?.tags) {
        client.context.tags[roleKey] = serviceName;
        client.context.tags[roleInstanceKey] = process.env.HOSTNAME || `${serviceName}-instance`;
        client.context.tags[appVerKey] = '1.0.0';
      }

      // 3. Telemetry processor ensures every outbound envelope has exact service name & metadata attached
      client.addTelemetryProcessor((envelope) => {
        if (!envelope.tags) {
          envelope.tags = {};
        }
        envelope.tags['ai.cloud.role'] = serviceName;
        envelope.tags['ai.cloud.roleInstance'] = process.env.HOSTNAME || `${serviceName}-instance`;
        envelope.tags['ai.application.ver'] = '1.0.0';

        if (envelope.data && (envelope.data as any).baseData) {
          const baseData = (envelope.data as any).baseData;
          baseData.properties = baseData.properties || {};
          baseData.properties['service.name'] = serviceName;
          baseData.properties['service.environment'] = process.env.NODE_ENV || 'production';
        }
        return true;
      });
    }

    isTelemetryInitialized = true;
    console.log(`[Telemetry] Azure Application Insights initialized for service: ${serviceName}`);
    return true;
  } catch (err) {
    console.error(`[Telemetry] Failed to initialize Application Insights for ${serviceName}:`, err);
    return false;
  }
}

export function getTelemetryClient() {
  return appInsights.defaultClient || null;
}

export function trackEvent(name: string, properties?: Record<string, any>): void {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackEvent({ name, properties });
  }
}

export function trackException(error: Error, properties?: Record<string, any>): void {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackException({ exception: error, properties });
  }
}

export function trackMetric(name: string, value: number, properties?: Record<string, any>): void {
  if (appInsights.defaultClient) {
    appInsights.defaultClient.trackMetric({ name, value, properties });
  }
}
