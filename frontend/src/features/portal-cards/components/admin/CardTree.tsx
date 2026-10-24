"use client";

import { ArrowDown, ArrowUp, FileText, FolderOpen, Plus, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import type { CardKind } from "../../types";
import type { CardTreeNode } from "./treeUtils";

const KIND_ICONS: Record<CardKind, typeof FileText> = {
  group: FolderOpen,
  form: FileText,
  document: ScrollText,
};

type Props = {
  nodes: CardTreeNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onAdd: (parentId: number) => void;
  onReorder: (parentId: number | null, orderedIds: number[]) => void;
};

function TreeLevel({
  nodes,
  parentId,
  depth,
  ...props
}: Props & { parentId: number | null; depth: number }) {
  const { selectedId, onSelect, onAdd, onReorder } = props;

  function swap(index: number, delta: -1 | 1) {
    const ids = nodes.map((node) => node.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    onReorder(parentId, ids);
  }

  return (
    <ul className="space-y-1">
      {nodes.map((node, index) => {
        const Icon = KIND_ICONS[node.kind];
        const selected = node.id === selectedId;
        return (
          <li key={node.id}>
            <div
              className={`flex items-center gap-1 rounded-xl border px-2 py-1.5 ${
                selected ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
              }`}
              style={{ marginInlineStart: depth * 16 }}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-start"
                onClick={() => onSelect(node.id)}
              >
                <Icon size={16} className="shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">{node.title}</span>
                {!node.is_published && (
                  <Badge variant="outline" className="shrink-0">
                    پیش‌نویس
                  </Badge>
                )}
              </button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="بالا" disabled={index === 0} onClick={() => swap(index, -1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-xs" aria-label="پایین" disabled={index === nodes.length - 1} onClick={() => swap(index, 1)}>
                <ArrowDown />
              </Button>
              {node.kind === "group" && (
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`افزودن به ${node.title}`} onClick={() => onAdd(node.id)}>
                  <Plus />
                </Button>
              )}
            </div>
            {node.children.length > 0 && (
              <TreeLevel {...props} nodes={node.children} parentId={node.id} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function CardTree(props: Props & { onAddRoot: () => void }) {
  const { onAddRoot, ...rest } = props;
  return (
    <div className="space-y-3">
      <Button type="button" className="w-full" onClick={onAddRoot}>
        <Plus /> افزودن کارت به صفحه اصلی
      </Button>
      {props.nodes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">هنوز کارتی ساخته نشده است.</p>
      ) : (
        <TreeLevel {...rest} parentId={null} depth={0} />
      )}
    </div>
  );
}
