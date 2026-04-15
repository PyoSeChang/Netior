import type { LayoutComputeInput, LayoutComputeResult } from '../types';
import { PIXELS_PER_DAY, todayEpochDays } from './scale-utils';
import { HEADER_TOTAL_HEIGHT } from './TimelineBackground';

const NODE_HEIGHT = 60;
const NODE_Y_GAP = 10;
const DEFAULT_NODE_WIDTH = 160;
const CONTENT_TOP = HEADER_TOTAL_HEIGHT + 40; // start placing nodes below header

export function computeTimelineLayout(input: LayoutComputeInput): LayoutComputeResult {
  const { nodes, config } = input;
  if (nodes.length === 0) return {};

  const originDay = (config._originDay as number) ?? todayEpochDays();
  const result: LayoutComputeResult = {};

  for (const node of nodes) {
    const timeValue = node.metadata.start_at as number | undefined;
    const endTimeValue = node.metadata.end_at as number | undefined;

    if (timeValue == null) {
      result[node.id] = { x: 0, y: CONTENT_TOP + 60 };
      continue;
    }

    const isPeriod = endTimeValue != null;

    if (isPeriod && endTimeValue != null) {
      const startX = (timeValue - originDay) * PIXELS_PER_DAY;
      const endX = (endTimeValue - originDay) * PIXELS_PER_DAY;
      const width = Math.abs(endX - startX);
      const centerX = (startX + endX) / 2;

      result[node.id] = {
        x: Math.round(centerX),
        y: Math.round(CONTENT_TOP + 10), // period bands near top
        width: Math.round(width),
      };
    } else {
      const x = (timeValue - originDay) * PIXELS_PER_DAY;
      const y = node.y > CONTENT_TOP ? node.y : CONTENT_TOP + 60;

      result[node.id] = {
        x: Math.round(x),
        y: Math.round(y),
      };
    }
  }

  const occurrences = nodes.filter(
    (n) => n.metadata.end_at == null && n.metadata.start_at != null && result[n.id],
  );
  occurrences.sort((a, b) => (result[a.id].x ?? 0) - (result[b.id].x ?? 0));

  const placed: Array<{ xStart: number; xEnd: number; y: number }> = [];

  for (const node of occurrences) {
    const pos = result[node.id];
    const nodeWidth = pos.width ?? node.width ?? DEFAULT_NODE_WIDTH;
    const halfW = nodeWidth / 2;
    const xStart = pos.x - halfW;
    const xEnd = pos.x + halfW;
    let y = pos.y;

    let collision = true;
    while (collision) {
      collision = false;
      for (const p of placed) {
        if (xStart < p.xEnd && xEnd > p.xStart && Math.abs(y - p.y) < NODE_HEIGHT + NODE_Y_GAP) {
          y = p.y + NODE_HEIGHT + NODE_Y_GAP;
          collision = true;
          break;
        }
      }
    }

    pos.y = Math.round(y);
    placed.push({ xStart, xEnd, y });
  }

  return result;
}
