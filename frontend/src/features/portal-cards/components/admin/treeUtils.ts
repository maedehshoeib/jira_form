import type { PortalCardSummary } from "../../types";

export type CardTreeNode = PortalCardSummary & { children: CardTreeNode[] };

export function buildTree(cards: PortalCardSummary[]): CardTreeNode[] {
  const nodes = new Map<number, CardTreeNode>();
  cards.forEach((card) => nodes.set(card.id, { ...card, children: [] }));
  const roots: CardTreeNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parent_id === null ? undefined : nodes.get(node.parent_id);
    (parent ? parent.children : roots).push(node);
  });
  const bySort = (a: CardTreeNode, b: CardTreeNode) => a.sort_order - b.sort_order || a.id - b.id;
  const sortDeep = (list: CardTreeNode[]) => {
    list.sort(bySort);
    list.forEach((node) => sortDeep(node.children));
  };
  sortDeep(roots);
  return roots;
}

export function descendantIds(cards: PortalCardSummary[], rootId: number): Set<number> {
  const result = new Set<number>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.pop() as number;
    for (const card of cards) {
      if (card.parent_id === current && !result.has(card.id)) {
        result.add(card.id);
        queue.push(card.id);
      }
    }
  }
  return result;
}

/** Human readable path such as «منابع انسانی › فرم‌ها». */
export function parentLabel(cards: PortalCardSummary[], id: number): string {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const parts: string[] = [];
  const seen = new Set<number>();
  let current = byId.get(id);
  while (current && !seen.has(current.id)) {
    parts.unshift(current.title);
    seen.add(current.id);
    current = current.parent_id === null ? undefined : byId.get(current.parent_id);
  }
  return parts.join(" › ");
}
