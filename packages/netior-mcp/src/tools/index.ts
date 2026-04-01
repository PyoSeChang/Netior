import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerArchetypeTools } from './archetype-tools.js';
import { registerRelationTypeTools } from './relation-type-tools.js';
import { registerCanvasTypeTools } from './canvas-type-tools.js';
import { registerConceptTools } from './concept-tools.js';
import { registerProjectTools } from './project-tools.js';
import { registerModuleTools } from './module-tools.js';
import { registerFilesystemTools } from './filesystem-tools.js';

export function registerAllTools(server: McpServer): void {
  registerArchetypeTools(server);
  registerRelationTypeTools(server);
  registerCanvasTypeTools(server);
  registerConceptTools(server);
  registerProjectTools(server);
  registerModuleTools(server);
  registerFilesystemTools(server);
}
