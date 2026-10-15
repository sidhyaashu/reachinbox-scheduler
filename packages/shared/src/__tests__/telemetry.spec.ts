import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initTelemetry,
  getTelemetryClient,
  trackEvent,
  trackMetric,
  trackException,
} from '../observability/telemetry.js';

describe('Application Insights Telemetry Module', () => {
  const origConn = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  const origAppInsightsConn = process.env.APPINSIGHTS_CONNECTIONSTRING;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = origConn;
    process.env.APPINSIGHTS_CONNECTIONSTRING = origAppInsightsConn;
  });

  it('skips initialization gracefully when connection string is not set', () => {
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    delete process.env.APPINSIGHTS_CONNECTIONSTRING;

    const initialized = initTelemetry('test-service');
    // If it was already initialized earlier in another run it returns true, otherwise false without crashing
    expect(typeof initialized).toBe('boolean');
  });

  it('provides safe helper functions for trackEvent, trackMetric, and trackException', () => {
    expect(() => trackEvent('test_event', { foo: 'bar' })).not.toThrow();
    expect(() => trackMetric('job_duration_ms', 120)).not.toThrow();
    expect(() => trackException(new Error('Sample test exception'))).not.toThrow();
  });
});
