import type { WorkspaceLayoutPlugin } from './types';
import { calendarPlugin } from './calendar';
import { freeformPlugin } from './freeform';
import { horizontalTimelinePlugin } from './horizontal-timeline';

const registry = new Map<string, WorkspaceLayoutPlugin>();

export function registerLayout(plugin: WorkspaceLayoutPlugin): void {
  registry.set(plugin.key, plugin);
}

export function getLayout(key?: string | null): WorkspaceLayoutPlugin {
  if (key && registry.has(key)) return registry.get(key)!;
  return registry.get('freeform')!;
}

export function listLayouts(): WorkspaceLayoutPlugin[] {
  return Array.from(registry.values());
}

// Register built-in plugins
registerLayout(freeformPlugin);
registerLayout(horizontalTimelinePlugin);
registerLayout(calendarPlugin);
