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

    if (appInsights.defaultClient?.context?.tags) {
      appInsights.defaultClient.context.tags[
        appInsights.defaultClient.context.keys.cloudRole
      ] = serviceName;
    }

    appInsights.start();
    isTelemetryInitialized = true;
    console.log(`[Telemetry] Azure Application Insights initialized for ${serviceName}`);
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
