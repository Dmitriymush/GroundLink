/**
 * Rotator Control Service
 *
 * Handles communication with rotator hardware via WIFI232-B2 UDP bridge.
 * Protocol ported from Pascal implementation (github.com/SkopasGit/rotation)
 */

// Types and constants
export * from './types';

// Frame builder for commands
export { RotatorFrameBuilder, defaultFrameBuilder } from './frame-builder';

// Telemetry parser
export { RotatorTelemetryParser, defaultTelemetryParser } from './telemetry-parser';
