import cairo from 'cairo';
import type { EditorRect } from '../shared/layout-editor.js';
import { singleLine } from './ui.js';

export type CanvasEntry = {
  index: number;
  rect: EditorRect;
  label: string;
};

export type CanvasMetrics = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type DrawEditorCanvasOptions = {
  monitor: { width: number; height: number };
  entries: CanvasEntry[];
  selectedIndex: number | null;
  selectedRect: EditorRect | null;
};

const CANVAS_PADDING = 16;
const HANDLE_RADIUS_PX = 8;

export function computeCanvasMetrics(
  width: number,
  height: number,
  monitor: { width: number; height: number },
): CanvasMetrics {
  const availableWidth = Math.max(1, width - CANVAS_PADDING * 2);
  const availableHeight = Math.max(1, height - CANVAS_PADDING * 2);
  const scale = Math.min(
    availableWidth / Math.max(1, monitor.width),
    availableHeight / Math.max(1, monitor.height),
  );

  return {
    scale,
    offsetX: (width - monitor.width * scale) / 2,
    offsetY: (height - monitor.height * scale) / 2,
  };
}

export function canvasToMonitorPoint(
  metrics: CanvasMetrics,
  x: number,
  y: number,
): { x: number; y: number } {
  return {
    x: (x - metrics.offsetX) / metrics.scale,
    y: (y - metrics.offsetY) / metrics.scale,
  };
}

export function canvasHandleRadius(metrics: CanvasMetrics): number {
  return HANDLE_RADIUS_PX / metrics.scale;
}

export function drawEditorCanvas(
  cr: any,
  width: number,
  height: number,
  options: DrawEditorCanvasOptions,
): CanvasMetrics {
  const metrics = computeCanvasMetrics(width, height, options.monitor);
  const { scale, offsetX, offsetY } = metrics;
  const monitorWidth = options.monitor.width * scale;
  const monitorHeight = options.monitor.height * scale;

  cr.setSourceRGBA(0, 0, 0, 0);
  cr.paint();
  cr.setSourceRGBA(0.1, 0.1, 0.12, 1);
  cr.rectangle(offsetX, offsetY, monitorWidth, monitorHeight);
  cr.fill();
  cr.setSourceRGBA(0.55, 0.55, 0.6, 1);
  cr.setLineWidth(1);
  cr.rectangle(offsetX, offsetY, monitorWidth, monitorHeight);
  cr.stroke();

  for (const entry of options.entries) {
    drawWindowRect(
      cr,
      entry,
      options.selectedIndex === entry.index,
      scale,
      offsetX,
      offsetY,
    );
  }

  if (options.selectedRect !== null) {
    drawHandles(cr, options.selectedRect, scale, offsetX, offsetY);
  }

  return metrics;
}

function drawWindowRect(
  cr: any,
  entry: CanvasEntry,
  selected: boolean,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const x = offsetX + entry.rect.x * scale;
  const y = offsetY + entry.rect.y * scale;
  const rectWidth = entry.rect.width * scale;
  const rectHeight = entry.rect.height * scale;

  if (selected) {
    cr.setSourceRGBA(0.95, 0.65, 0.2, 0.32);
  } else {
    cr.setSourceRGBA(0.25, 0.55, 0.9, 0.22);
  }
  cr.rectangle(x, y, rectWidth, rectHeight);
  cr.fill();

  if (selected) {
    cr.setSourceRGBA(1, 0.75, 0.3, 1);
    cr.setLineWidth(2);
  } else {
    cr.setSourceRGBA(0.35, 0.65, 1, 0.9);
    cr.setLineWidth(1);
  }
  cr.rectangle(x, y, rectWidth, rectHeight);
  cr.stroke();

  cr.selectFontFace('Sans', cairo.FontSlant.NORMAL, cairo.FontWeight.NORMAL);
  cr.setFontSize(11);
  cr.setSourceRGBA(1, 1, 1, 0.95);
  cr.moveTo(x + 6, y + 16);
  cr.showText(singleLine(entry.label).slice(0, 48));
}

function drawHandles(
  cr: any,
  rect: EditorRect,
  scale: number,
  offsetX: number,
  offsetY: number,
): void {
  const x = offsetX + rect.x * scale;
  const y = offsetY + rect.y * scale;
  const rectWidth = rect.width * scale;
  const rectHeight = rect.height * scale;
  const points = [
    [x, y],
    [x + rectWidth / 2, y],
    [x + rectWidth, y],
    [x + rectWidth, y + rectHeight / 2],
    [x + rectWidth, y + rectHeight],
    [x + rectWidth / 2, y + rectHeight],
    [x, y + rectHeight],
    [x, y + rectHeight / 2],
  ];

  for (const [handleX, handleY] of points) {
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.rectangle(handleX - 4, handleY - 4, 8, 8);
    cr.fill();
    cr.setSourceRGBA(0.1, 0.1, 0.12, 1);
    cr.rectangle(handleX - 4, handleY - 4, 8, 8);
    cr.stroke();
  }
}
