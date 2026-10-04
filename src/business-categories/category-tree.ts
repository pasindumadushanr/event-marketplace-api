export type CategoryNode = {
  id: string;
  parentId: string | null;
  status: string;
};

export function descendantIds(nodes: CategoryNode[], rootId: string): string[] {
  const visited = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    pending.push(
      ...nodes.filter((node) => node.parentId === id).map((node) => node.id),
    );
  }
  return [...visited];
}

export function isCategoryActive(nodes: CategoryNode[], id: string): boolean {
  const visited = new Set<string>();
  let node = nodes.find((item) => item.id === id);
  while (node) {
    if (visited.has(node.id) || node.status !== 'ACTIVE') return false;
    visited.add(node.id);
    if (!node.parentId) return true;
    node = nodes.find((item) => item.id === node!.parentId);
  }
  return false;
}
