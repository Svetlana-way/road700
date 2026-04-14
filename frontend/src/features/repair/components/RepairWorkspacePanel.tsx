import { type ComponentProps } from "react";
import { RepairPanel } from "../../../components/RepairPanel";
import { RepairWorkspaceContentPanel } from "../../../components/RepairWorkspaceContentPanel";

type RepairWorkspaceContentProps = ComponentProps<typeof RepairWorkspaceContentPanel>;

type RepairWorkspacePanelProps = {
  returnLabel: string | null;
  onReturn: (() => void) | null;
  contentProps: RepairWorkspaceContentProps;
};

export function RepairWorkspacePanel({ returnLabel, onReturn, contentProps }: RepairWorkspacePanelProps) {
  return (
    <RepairPanel returnLabel={returnLabel} onReturn={onReturn}>
      <RepairWorkspaceContentPanel {...contentProps} />
    </RepairPanel>
  );
}
