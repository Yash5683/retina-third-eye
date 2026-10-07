/**
 * useEdgeDetector — runs COCO-SSD on-device via TensorFlow.js
 *
 * Strategy:
 *  1. Load model once (lazy, on first use) → ~5MB download, cached by browser
 *  2. Run inference on a video element directly (fastest path, no canvas copy)
 *  3. Return detections with class, score, bbox
 *  4. Expose loadingState so UI can show a loading indicator
 */
import { useRef, useState, useCallback, useEffect } from 'react';

let _modelPromise = null; // singleton — shared across all hook instances

async function loadModel() {
  if (!_modelPromise) {
    _modelPromise = (async () => {
      // Dynamic import keeps TF out of the initial bundle
      const tf = await import('@tensorflow/tfjs');
      const cocoSsd = await import('@tensorflow-models/coco-ssd');

      // Use WebGL backend for GPU acceleration, fall back to WASM/CPU
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        try {
          await tf.setBackend('cpu');
          await tf.ready();
        } catch (e) {
          console.warn('[EdgeAI] TF backend failed:', e);
        }
      }

      const model = await cocoSsd.load({
        base: 'lite_mobilenet_v2', // smallest + fastest — ~1.6MB, good for mobile
      });
      return model;
    })();
  }
  return _modelPromise;
}

export function useEdgeDetector() {
  const [modelState, setModelState] = useState('idle'); // idle | loading | ready | error
  const [detections, setDetections] = useState([]);
  const modelRef = useRef(null);
  const runningRef = useRef(false);
  const loopRef = useRef(null);

  // Pre-warm the model on hook mount
  useEffect(() => {
    let cancelled = false;
    setModelState('loading');
    loadModel()
      .then(model => {
        if (cancelled) return;
        modelRef.current = model;
        setModelState('ready');
      })
      .catch(err => {
        if (cancelled) return;
        console.warn('[EdgeAI] Model load failed:', err);
        setModelState('error');
        _modelPromise = null; // allow retry
      });
    return () => { cancelled = true; };
  }, []);

  /**
   * Run a single inference pass on a video element.
   * @param {HTMLVideoElement} videoEl
   * @returns {Array} detections [{class, score, bbox:[x,y,w,h]}]
   */
  const detectOnce = useCallback(async (videoEl) => {
    if (!modelRef.current) return [];
    if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return [];
    try {
      const results = await modelRef.current.detect(videoEl);
      return results.filter(d => d.score >= 0.45); // min confidence threshold
    } catch (err) {
      console.warn('[EdgeAI] Inference error:', err);
      return [];
    }
  }, []);

  /**
   * Start a continuous detection loop at ~4 fps (250ms interval).
   * @param {React.RefObject} videoRef — ref to <video> element
   * @param {function} onDetect — callback with detections array
   */
  const startLoop = useCallback((videoRef, onDetect) => {
    if (runningRef.current) return;
    runningRef.current = true;

    async function tick() {
      if (!runningRef.current) return;
      const videoEl = videoRef?.current;
      const results = await detectOnce(videoEl);
      if (runningRef.current) {
        setDetections(results);
        onDetect?.(results);
      }
      loopRef.current = setTimeout(tick, 250); // 4 fps — balanced speed vs battery
    }

    tick();
  }, [detectOnce]);

  const stopLoop = useCallback(() => {
    runningRef.current = false;
    if (loopRef.current) clearTimeout(loopRef.current);
    loopRef.current = null;
    setDetections([]);
  }, []);

  /**
   * Convert COCO-SSD detections to our app's Observation format.
   */
  const detectionsToObservations = useCallback((dets, videoWidth = 640) => {
    return dets.map(d => {
      const [x, , w] = d.bbox;
      const center = x + w / 2;
      const position = center < videoWidth * 0.33 ? 'left'
        : center > videoWidth * 0.66 ? 'right'
        : 'center';

      // Estimate size from bbox area relative to frame
      const area = (d.bbox[2] * d.bbox[3]) / (videoWidth * videoWidth * 0.75);
      const size = area > 0.4 ? 'very_large' : area > 0.2 ? 'large' : area > 0.05 ? 'medium' : 'small';

      return {
        object: d.class,
        color: 'unknown',
        position,
        location: `detected ${position}, ${size} size`,
        timestamp: new Date().toISOString(),
        confidence: Math.round(d.score * 100) / 100,
        size,
        bbox: d.bbox,
        source: 'edge',
      };
    });
  }, []);

  return {
    modelState,   // 'idle' | 'loading' | 'ready' | 'error'
    detections,   // raw COCO-SSD detections
    detectOnce,
    startLoop,
    stopLoop,
    detectionsToObservations,
  };
}
