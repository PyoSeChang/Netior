import type { TranslationKey } from '@netior/shared/i18n';
import {
  Activity,
  Bot,
  Boxes,
  FolderKanban,
  FolderTree,
  Settings,
  Sparkles,
  Terminal,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityBarBottomItemKey, ActivityBarTopItemKey } from './activity-bar-layout';

interface ActivityBarItemDefinition<K extends string> {
  key: K;
  icon: LucideIcon;
  labelKey: TranslationKey;
}

export const ACTIVITY_BAR_TOP_ITEM_DEFINITIONS: Record<
  ActivityBarTopItemKey,
  ActivityBarItemDefinition<ActivityBarTopItemKey>
> = {
  projects: { key: 'projects', icon: FolderKanban, labelKey: 'project.title' },
  networks: { key: 'networks', icon: Waypoints, labelKey: 'sidebar.networks' },
  files: { key: 'files', icon: FolderTree, labelKey: 'sidebar.files' },
  sessions: { key: 'sessions', icon: Activity, labelKey: 'sidebar.sessions' },
};

export const ACTIVITY_BAR_BOTTOM_ITEM_DEFINITIONS: Record<
  ActivityBarBottomItemKey,
  ActivityBarItemDefinition<ActivityBarBottomItemKey>
> = {
  ontology: { key: 'ontology', icon: Boxes, labelKey: 'sidebar.ontology' },
  narre: { key: 'narre', icon: Sparkles, labelKey: 'narre.title' },
  terminal: { key: 'terminal', icon: Terminal, labelKey: 'sidebar.terminal' },
  agents: { key: 'agents', icon: Bot, labelKey: 'sidebar.agents' },
  settings: { key: 'settings', icon: Settings, labelKey: 'sidebar.settings' },
};
