import { registerProjectIpc } from './project-ipc';
import { registerConceptIpc } from './concept-ipc';
import { registerNetworkIpc } from './network-ipc';
import { registerLayoutIpc } from './layout-ipc';
import { registerFileIpc } from './file-ipc';
import { registerFsIpc } from './fs-ipc';
import { registerModuleIpc } from './module-ipc';
import { registerEditorPrefsIpc } from './editor-prefs-ipc';
import { registerArchetypeIpc } from './archetype-ipc';
import { registerConceptPropertyIpc } from './concept-property-ipc';
import { registerConceptContentIpc } from './concept-content-ipc';
import { registerPtyIpc } from './pty-ipc';
import { registerConfigIpc } from './config-ipc';
import { registerRelationTypeIpc } from './relation-type-ipc';
import { registerObjectIpc } from './object-ipc';
import { registerNarreIpc } from './narre-ipc';
import { registerContextIpc } from './context-ipc';

export function registerAllIpc(): void {
  registerProjectIpc();
  registerConceptIpc();
  registerNetworkIpc();
  registerLayoutIpc();
  registerFileIpc();
  registerFsIpc();
  registerModuleIpc();
  registerEditorPrefsIpc();
  registerArchetypeIpc();
  registerConceptPropertyIpc();
  registerConceptContentIpc();
  registerPtyIpc();
  registerConfigIpc();
  registerRelationTypeIpc();
  registerObjectIpc();
  registerNarreIpc();
  registerContextIpc();
}
