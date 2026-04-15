import fs from 'fs/promises';
import path from 'path';
import { normalizeNetiorToolName } from '@netior/shared/constants';

interface ProjectApprovalGrant {
  operationKey: string;
  decision: 'allow';
  scope: 'project';
  createdAt: string;
}

interface ProjectApprovalFileV1 {
  version: 1;
  allowedTools: string[];
}

interface ProjectApprovalFileV2 {
  version: 2;
  grants: ProjectApprovalGrant[];
}

type ProjectApprovalFile = ProjectApprovalFileV1 | ProjectApprovalFileV2;

function createEmptyApprovalFile(): ProjectApprovalFileV2 {
  return {
    version: 2,
    grants: [],
  };
}

export class ApprovalStore {
  constructor(private readonly dataDir: string) {}

  private projectDir(projectId: string): string {
    return path.join(this.dataDir, 'narre', projectId);
  }

  private approvalsPath(projectId: string): string {
    return path.join(this.projectDir(projectId), 'approvals.json');
  }

  private async ensureDir(projectId: string): Promise<void> {
    await fs.mkdir(this.projectDir(projectId), { recursive: true });
  }

  private async readApprovalFile(projectId: string): Promise<ProjectApprovalFileV2> {
    try {
      const raw = await fs.readFile(this.approvalsPath(projectId), 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ProjectApprovalFile>;
      if (parsed.version === 2 && Array.isArray((parsed as Partial<ProjectApprovalFileV2>).grants)) {
        return {
          version: 2,
          grants: (parsed as Partial<ProjectApprovalFileV2>).grants!
            .filter((grant): grant is ProjectApprovalGrant =>
              Boolean(grant)
              && typeof grant.operationKey === 'string'
              && grant.operationKey.trim().length > 0
              && grant.decision === 'allow'
              && grant.scope === 'project'
              && typeof grant.createdAt === 'string'
              && grant.createdAt.trim().length > 0,
            )
            .map((grant) => ({
              ...grant,
              operationKey: normalizeNetiorToolName(grant.operationKey),
            })),
        };
      }

      if (parsed.version === 1 && Array.isArray((parsed as Partial<ProjectApprovalFileV1>).allowedTools)) {
        return {
          version: 2,
          grants: (parsed as Partial<ProjectApprovalFileV1>).allowedTools!
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
            .map((value) => ({
              operationKey: normalizeNetiorToolName(value),
              decision: 'allow' as const,
              scope: 'project' as const,
              createdAt: new Date(0).toISOString(),
            })),
        };
      }
    } catch {
      // fall through
    }

    return createEmptyApprovalFile();
  }

  private async writeApprovalFile(projectId: string, data: ProjectApprovalFileV2): Promise<void> {
    await this.ensureDir(projectId);
    await fs.writeFile(this.approvalsPath(projectId), JSON.stringify(data, null, 2), 'utf-8');
  }

  async isOperationAllowed(projectId: string, operationKey: string): Promise<boolean> {
    const file = await this.readApprovalFile(projectId);
    const normalizedOperationKey = normalizeNetiorToolName(operationKey);
    return file.grants.some((grant) => grant.operationKey === normalizedOperationKey && grant.decision === 'allow');
  }

  async allowOperation(projectId: string, operationKey: string): Promise<void> {
    const file = await this.readApprovalFile(projectId);
    const normalizedOperationKey = normalizeNetiorToolName(operationKey);
    if (file.grants.some((grant) => grant.operationKey === normalizedOperationKey && grant.decision === 'allow')) {
      return;
    }

    file.grants.push({
      operationKey: normalizedOperationKey,
      decision: 'allow',
      scope: 'project',
      createdAt: new Date().toISOString(),
    });
    file.grants.sort((left, right) => left.operationKey.localeCompare(right.operationKey));
    await this.writeApprovalFile(projectId, file);
  }

  async isToolAllowed(projectId: string, toolName: string): Promise<boolean> {
    return this.isOperationAllowed(projectId, toolName);
  }

  async allowTool(projectId: string, toolName: string): Promise<void> {
    await this.allowOperation(projectId, toolName);
  }
}
