export type RecipientGroupPerson = {
  id: number;
  display_name: string;
  username: string;
  department?: string;
  job_title?: string;
};

export type RecipientGroupMember = RecipientGroupPerson & {
  department: string;
  job_title: string;
  is_active: boolean;
};

export type RecipientGroup = {
  id: number;
  name: string;
  is_shared: boolean;
  members: RecipientGroupMember[];
};

export type RecipientGroupInput = {
  name: string;
  member_ids: number[];
};

export function toggleGroupMembers(
  selectedIds: number[],
  memberIds: number[],
  availableIds: ReadonlySet<number>,
): { nextIds: number[]; eligibleIds: number[] } {
  const eligibleIds = memberIds.filter((id) => availableIds.has(id));
  const selected = new Set(selectedIds);
  const allSelected =
    eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));
  if (allSelected) {
    const drop = new Set(eligibleIds);
    return {
      nextIds: selectedIds.filter((id) => !drop.has(id)),
      eligibleIds,
    };
  }
  const nextIds = [...selectedIds];
  for (const id of eligibleIds) {
    if (!selected.has(id)) nextIds.push(id);
  }
  return { nextIds, eligibleIds };
}
