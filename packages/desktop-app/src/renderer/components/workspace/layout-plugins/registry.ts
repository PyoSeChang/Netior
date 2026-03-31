import type { CanvasLayoutPlugin } from './types';
import { freeformPlugin } from './freeform';
import { horizontalTimelinePlugin } from './horizontal-timeline';

const registry = new Map<string, CanvasLayoutPlugin>();

export function registerLayout(plugin: CanvasLayoutPlugin): void {
  registry.set(plugin.key, plugin);
}

export function getLayout(key?: string | null): CanvasLayoutPlugin {
  if (key && registry.has(key)) return registry.get(key)!;
  return registry.get('freeform')!;
}

export function listLayouts(): CanvasLayoutPlugin[] {
  return Array.from(registry.values());
}

// Register built-in plugins
registerLayout(freeformPlugin);
registerLayout(horizontalTimelinePlugin);
