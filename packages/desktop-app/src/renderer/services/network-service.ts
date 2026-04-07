import type {
  Network, NetworkCreate, NetworkUpdate,
  NetworkNode, NetworkNodeCreate, NetworkNodeUpdate,
  Edge, EdgeCreate, EdgeUpdate,
  Concept, FileEntity, RelationType, NetworkBreadcrumbItem,
  NetworkTreeNode,
} from '@netior/shared/types';

export interface NetworkFullData {
  network: Network;
  nodes: (NetworkNode & { concept?: Concept; file?: FileEntity; network_count: number })[];
  edges: (Edge & { relation_type?: RelationType })[];
}
import { unwrapIpc } from './ipc';

// Network
export async function createNetwork(data: NetworkCreate): Promise<Network> {
  return unwrapIpc(await window.electron.network.create(data as unknown as Record<string, unknown>));
}

export async function listNetworks(projectId: string, rootOnly?: boolean): Promise<Network[]> {
  return unwrapIpc(await window.electron.network.list(projectId, rootOnly));
}

export async function updateNetwork(id: string, data: NetworkUpdate): Promise<Network> {
  return unwrapIpc(await window.electron.network.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteNetwork(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.network.delete(id));
}

export async function getNetworkFull(networkId: string): Promise<NetworkFullData | undefined> {
  return unwrapIpc(await window.electron.network.getFull(networkId));
}

export async function getNetworksByConcept(conceptId: string): Promise<Network[]> {
  return unwrapIpc(await window.electron.network.getByConcept(conceptId));
}

export async function getNetworkAncestors(networkId: string): Promise<NetworkBreadcrumbItem[]> {
  return unwrapIpc(await window.electron.network.getAncestors(networkId));
}

export async function getNetworkTree(projectId: string): Promise<NetworkTreeNode[]> {
  return unwrapIpc(await window.electron.network.getTree(projectId));
}

// Network Node
export async function addNetworkNode(data: NetworkNodeCreate): Promise<NetworkNode> {
  return unwrapIpc(await window.electron.networkNode.add(data as unknown as Record<string, unknown>));
}

export async function updateNetworkNode(id: string, data: NetworkNodeUpdate): Promise<NetworkNode> {
  return unwrapIpc(await window.electron.networkNode.update(id, data as unknown as Record<string, unknown>));
}

export async function removeNetworkNode(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.networkNode.remove(id));
}

// Edge
export async function createEdge(data: EdgeCreate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.create(data as unknown as Record<string, unknown>));
}

export async function getEdge(id: string): Promise<Edge | undefined> {
  return unwrapIpc(await window.electron.edge.get(id));
}

export async function updateEdge(id: string, data: EdgeUpdate): Promise<Edge> {
  return unwrapIpc(await window.electron.edge.update(id, data as unknown as Record<string, unknown>));
}

export async function deleteEdge(id: string): Promise<boolean> {
  return unwrapIpc(await window.electron.edge.delete(id));
}

export const networkService = {
  create: createNetwork, list: listNetworks, update: updateNetwork,
  delete: deleteNetwork, getFull: getNetworkFull,
  getNetworksByConcept, getAncestors: getNetworkAncestors, getTree: getNetworkTree,
  node: { add: addNetworkNode, update: updateNetworkNode, remove: removeNetworkNode },
  edge: { create: createEdge, get: getEdge, update: updateEdge, delete: deleteEdge },
};
