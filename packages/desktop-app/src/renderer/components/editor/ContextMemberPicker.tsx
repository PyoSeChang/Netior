import React, { useMemo, useState } from 'react';
import type { ContextMember } from '@netior/shared/types';
import { X } from 'lucide-react';
import { useNetworkStore, type NetworkNodeWithObject, type EdgeWithRelationType } from '../../stores/network-store';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useI18n } from '../../hooks/useI18n';

interface ContextMemberPickerProps {
  existingMembers: ContextMember[];
  onSelect: (memberType: 'object' | 'edge', memberId: string) => void;
  onClose: () => void;
}

function getNodeLabel(node: NetworkNodeWithObject): string {
  if (node.concept) return node.concept.title;
  if (node.file?.path) return node.file.path.replace(/\\/g, '/').split('/').pop() ?? node.file.path;
  return node.object?.object_type ?? 'Object';
}

function getEdgeLabel(edge: EdgeWithRelationType, nodes: NetworkNodeWithObject[]): string {
  const sourceNode = nodes.find((node) => node.id === edge.source_node_id);
  const targetNode = nodes.find((node) => node.id === edge.target_node_id);
  const sourceLabel = sourceNode ? getNodeLabel(sourceNode) : '?';
  const targetLabel = targetNode ? getNodeLabel(targetNode) : '?';
  return edge.model?.name
    ? `${sourceLabel} -[${edge.model.name}]-> ${targetLabel}`
    : `${sourceLabel} -> ${targetLabel}`;
}

export function ContextMemberPicker({
  existingMembers,
  onSelect,
  onClose,
}: ContextMemberPickerProps): JSX.Element {
  const { t } = useI18n();
  const nodes = useNetworkStore((state) => state.nodes);
  const edges = useNetworkStore((state) => state.edges);
  const [search, setSearch] = useState('');

  const existingObjectIds = useMemo(
    () => new Set(existingMembers.filter((member) => member.member_type === 'object').map((member) => member.member_id)),
    [existingMembers],
  );
  const existingEdgeIds = useMemo(
    () => new Set(existingMembers.filter((member) => member.member_type === 'edge').map((member) => member.member_id)),
    [existingMembers],
  );

  const query = search.trim().toLowerCase();

  const objectCandidates = useMemo(
    () =>
      nodes.filter((node) => node.object && !existingObjectIds.has(node.object.id)).filter((node) => {
        if (!query) return true;
        return getNodeLabel(node).toLowerCase().includes(query);
      }),
    [existingObjectIds, nodes, query],
  );

  const edgeCandidates = useMemo(
    () =>
      edges.filter((edge) => !existingEdgeIds.has(edge.id)).filter((edge) => {
        if (!query) return true;
        return getEdgeLabel(edge, nodes).toLowerCase().includes(query);
      }),
    [edges, existingEdgeIds, nodes, query],
  );

  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/55 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="flex w-full max-w-[520px] flex-col rounded-xl border border-subtle bg-surface-floating shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
          <div className="text-sm font-medium text-default">Add Member</div>
          <button
            type="button"
            className="rounded p-1 text-muted transition-colors hover:bg-state-hover hover:text-default"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <Input
            inputSize="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search members..."
            autoFocus
          />

          <div className="grid max-h-[420px] gap-3 overflow-auto md:grid-cols-2">
            <div className="rounded border border-subtle bg-surface-card">
              <div className="border-b border-subtle px-3 py-2 text-xs font-medium text-secondary">
                Objects
              </div>
              <div className="flex flex-col py-1">
                {objectCandidates.length > 0 ? (
                  objectCandidates.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-state-hover"
                      onClick={() => {
                        if (node.object) onSelect('object', node.object.id);
                      }}
                    >
                      <Badge variant="accent">{node.object?.object_type ?? 'object'}</Badge>
                      <span className="truncate text-sm text-default">{getNodeLabel(node)}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-xs text-muted">No members</div>
                )}
              </div>
            </div>

            <div className="rounded border border-subtle bg-surface-card">
              <div className="border-b border-subtle px-3 py-2 text-xs font-medium text-secondary">
                Edges
              </div>
              <div className="flex flex-col py-1">
                {edgeCandidates.length > 0 ? (
                  edgeCandidates.map((edge) => (
                    <button
                      key={edge.id}
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-state-hover"
                      onClick={() => onSelect('edge', edge.id)}
                    >
                      <Badge>edge</Badge>
                      <span className="truncate text-sm text-default">{getEdgeLabel(edge, nodes)}</span>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-xs text-muted">No members</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
