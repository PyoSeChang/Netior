import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSchemaTools } from './schema-tools.js';
import { registerSchemaFieldTools } from './schema-field-tools.js';
import { registerSchemaMeaningTools } from './schema-meaning-tools.js';
import { registerCandidateSourceTools } from './candidate-source-tools.js';
import { registerConceptPropertyTools } from './concept-property-tools.js';
import { registerEdgeTools } from './edge-tools.js';
import { registerConceptTools } from './concept-tools.js';
import { registerNetworkNodeTools } from './network-node-tools.js';
import { registerNetworkTools } from './network-tools.js';
import { registerObjectTools } from './object-tools.js';
import { registerProjectTools } from './project-tools.js';
import { registerTypeGroupTools } from './type-group-tools.js';
import { registerFilesystemTools } from './filesystem-tools.js';
import { registerPdfTools } from './pdf-tools.js';
import { registerModuleTools } from './module-tools.js';
import { registerModelTools } from './model-tools.js';

export function registerAllTools(server: McpServer): void {
  registerSchemaTools(server);
  registerSchemaFieldTools(server);
  registerSchemaMeaningTools(server);
  registerModelTools(server);
  registerCandidateSourceTools(server);
  registerTypeGroupTools(server);
  registerConceptTools(server);
  registerConceptPropertyTools(server);
  registerObjectTools(server);
  registerNetworkTools(server);
  registerNetworkNodeTools(server);
  registerEdgeTools(server);
  registerProjectTools(server);
  registerModuleTools(server);
  registerFilesystemTools(server);
  registerPdfTools(server);
}
