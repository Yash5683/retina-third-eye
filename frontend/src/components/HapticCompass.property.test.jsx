/**
 * Property 9: Haptic Trigger Only on Center Detection
 *
 * For any sequence of detection results, navigator.vibrate SHALL be called
 * if and only if position === "center". For "left", "right", and "not_found"
 * positions, no vibration SHALL be triggered.
 *
 * Validates: Requirements 4.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import * as fc from 'fast-check';
import HapticCompass from './HapticCompass';
import * as api from '../api';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Simulate one detection cycle for the given position.
 * Returns true if navigator.vibrate was called during that cycle.
 *
 * HapticCompass now checks `typeof navigator.vibrate === 'function'` at
 * call-time (not module-load-time), so installing the mock before render is
 * sufficient — no module reset required.
 */
async function simulateDetection(position) {
  const vibrateMock = vi.fn();
  Object.defineProperty(navigator, 'vibrate', {
    value: vibrateMock,
    writable: true,
    configurable: true,
  });

  vi.spyOn(api, 'detectObject').mockResolvedValue({ position, confidence: 0.9 });

  const cameraRef = { current: { captureFrame: () => 'data:image/jpeg;base64,fake' } };

  vi.useFakeTimers();

  render(
    <HapticCompass
      targetObject="wallet"
      cameraRef={cameraRef}
      onFound={() => {}}
      onTimeout={() => {}}
      onCancel={() => {}}
    />
  );

  // Advance one detection interval (100 ms) and flush the async queue.
  await act(async () => {
    vi.advanceTimersByTime(100);
    await Promise.resolve();
    await Promise.resolve();
  });

  // Only count calls with a positive duration — vibrate(0) is the "stop"
  // signal emitted by stopHaptic() on cleanup and should not count as a pulse.
  const wasCalled = vibrateMock.mock.calls.some(([arg]) => typeof arg === 'number' && arg > 0);

  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();

  // Reset navigator.vibrate to undefined so the next run starts clean.
  Object.defineProperty(navigator, 'vibrate', {
    value: undefined,
    writable: true,
    configurable: true,
  });

  return wasCalled;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property 9: Haptic Trigger Only on Center Detection', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('vibrates if and only if position is "center" (fast-check, 100 runs)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('left', 'center', 'right', 'not_found'),
        async (position) => {
          const vibrateCalled = await simulateDetection(position);
          // Core invariant: vibrate ↔ center
          return (position === 'center') === vibrateCalled;
        }
      ),
      { numRuns: 100 }
    );
  });

  // Concrete examples for clear failure messages
  it('does NOT vibrate for position "left"', async () => {
    expect(await simulateDetection('left')).toBe(false);
  });

  it('does NOT vibrate for position "right"', async () => {
    expect(await simulateDetection('right')).toBe(false);
  });

  it('does NOT vibrate for position "not_found"', async () => {
    expect(await simulateDetection('not_found')).toBe(false);
  });

  it('DOES vibrate for position "center"', async () => {
    expect(await simulateDetection('center')).toBe(true);
  });
});
