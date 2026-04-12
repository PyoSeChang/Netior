import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerArchetypeTools } from './archetype-tools.js';
import { registerArchetypeFieldTools } from './archetype-field-tools.js';
import { registerCandidateSourceTools } from './candidate-source-tools.js';
import { registerConceptPropertyTools } from './concept-property-tools.js';
import { registerEdgeTools } from './edge-tools.js';
import { registerRelationTypeTools } from './relation-type-tools.js';
import { registerConceptTools } from './concept-tools.js';
import { registerNetworkNodeTools } from './network-node-tools.js';
import { registerNetworkTools } from './network-tools.js';
import { registerObjectTools } from './object-tools.js';
import { registerProjectTools } from './project-tools.js';
import { registerTypeGroupTools } from './type-group-tools.js';
import { registerFilesystemTools } from './filesystem-tools.js';
import { registerPdfTools } from './pdf-tools.js';

export function registerAllTools(server: McpServer): void {
  registerArchetypeTools(server);
  registerArchetypeFieldTools(server);
  registerCandidateSourceTools(server);
  registerRelationTypeTools(server);
  registerTypeGroupTools(server);
  registerConceptTools(server);
  registerConceptPropertyTools(server);
  registerObjectTools(server);
  registerNetworkTools(server);
  registerNetworkNodeTools(server);
  registerEdgeTools(server);
  registerProjectTools(server);
  registerFilesystemTools(server);
  registerPdfTools(server);
}
