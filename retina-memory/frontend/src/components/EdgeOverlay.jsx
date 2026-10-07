/**
 * EdgeOverlay — draws real-time bounding boxes from COCO-SSD
 * on top of the camera feed using a canvas overlay.
 */
import { useEffect, useRef } from 'react';

const CLASS_COLORS = {
  person:       '#ef4444',
  chair:        '#3b82f6',
  table:        '#3b82f6',
  laptop:       '#8b5cf6',
  phone:        '#10b981',
  cell_phone:   '#10b981',
  bottle:       '#06b6d4',
  cup:          '#f59e0b',
  book:         '#f59e0b',
  bag:          '#f97316',
  backpack:     '#f97316',
  handbag:      '#f97316',
  keyboard:     '#8b5cf6',
  mouse:        '#8b5cf6',
  remote:       '#a855f7',
  clock:        '#fbbf24',
  dog:          '#f97316',
  cat:          '#f97316',
  car:          '#ef4444',
  bicycle:      '#10b981',
  default:      '#3b82f6',
};

function getColor(cls) {
  return CLASS_COLORS[cls] ?? CLASS_COLORS.default;
}

export default function EdgeOverlay({ detections = [], videoWidth = 640, videoHeight = 480, style = {} }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!detections.length) return;

    // Scale factor — canvas may be displayed smaller than native video resolution
    const scaleX = canvas.width / videoWidth;
    const scaleY = canvas.height / videoHeight;

    detections.forEach(det => {
      const [x, y, w, h] = det.bbox;
      const sx = x * scaleX;
      const sy = y * scaleY;
      const sw = w * scaleX;
      const sh = h * scaleY;

      const color = getColor(det.class);
      const alpha = Math.max(0.5, det.score);
      const conf = Math.round(det.score * 100);

      // ── Bounding box ──
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = alpha;

      // Rounded rect
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(sx + r, sy);
      ctx.lineTo(sx + sw - r, sy);
      ctx.quadraticCurveTo(sx + sw, sy, sx + sw, sy + r);
      ctx.lineTo(sx + sw, sy + sh - r);
      ctx.quadraticCurveTo(sx + sw, sy + sh, sx + sw - r, sy + sh);
      ctx.lineTo(sx + r, sy + sh);
      ctx.quadraticCurveTo(sx, sy + sh, sx, sy + sh - r);
      ctx.lineTo(sx, sy + r);
      ctx.quadraticCurveTo(sx, sy, sx + r, sy);
      ctx.closePath();
      ctx.stroke();

      // Corner accents — top-left
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      const cLen = Math.min(sw, sh) * 0.2;
      ctx.beginPath();
      ctx.moveTo(sx, sy + cLen); ctx.lineTo(sx, sy); ctx.lineTo(sx + cLen, sy);
      ctx.stroke();
      // top-right
      ctx.beginPath();
      ctx.moveTo(sx + sw - cLen, sy); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + cLen);
      ctx.stroke();
      // bottom-left
      ctx.beginPath();
      ctx.moveTo(sx, sy + sh - cLen); ctx.lineTo(sx, sy + sh); ctx.lineTo(sx + cLen, sy + sh);
      ctx.stroke();
      // bottom-right
      ctx.beginPath();
      ctx.moveTo(sx + sw - cLen, sy + sh); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(sx + sw, sy + sh - cLen);
      ctx.stroke();

      // ── Label pill ──
      const label = `${det.class}  ${conf}%`;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const ph = 18, pw = tw + 14;
      const lx = sx;
      const ly = sy > ph + 4 ? sy - ph - 4 : sy + sh + 4;

      // Pill background
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(lx, ly, pw, ph, 4);
      ctx.fill();

      // Label text
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + 7, ly + ph - 5);

      ctx.restore();
    });
  }, [detections, videoWidth, videoHeight]);

  return (
    <canvas
      ref={canvasRef}
      width={videoWidth}
      height={videoHeight}
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        ...style,
      }}
    />
  );
}
