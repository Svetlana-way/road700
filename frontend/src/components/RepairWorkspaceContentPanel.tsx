import { type ComponentProps } from "react";
import { Button, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { RepairTabsPanel } from "./RepairTabsPanel";
import { ReviewDecisionPanel } from "./ReviewDecisionPanel";

type UserRole = "admin" | "employee";
type ReviewPriorityBucket = "review" | "critical" | "suspicious";

type ReviewDecisionProps = ComponentProps<typeof ReviewDecisionPanel>;
type RepairTabsProps = ComponentProps<typeof RepairTabsPanel>;

type RepairWorkspaceContentPanelProps = {
  userRole: UserRole | undefined;
  repairLoading: boolean;
  selectedRepair: RepairTabsProps["selectedRepair"] | null;
  selectedReviewItem: ReviewDecisionProps["selectedReviewItem"];
  isEditingRepair: boolean;
  saveRepairLoading: boolean;
  hasRepairDraft: boolean;
  repairExportLoading: boolean;
  repairArchiveLoading: boolean;
  repairDeleteLoading: boolean;
  onCancelEdit: () => void;
  onSaveRepair: () => void;
  onExportRepair: () => void;
  onStartEdit: () => void;
  onArchiveRepair: () => void;
  onDeleteRepair: (repairId: number) => void;
  reviewDecisionProps: ReviewDecisionProps | null;
  repairTabsProps: RepairTabsProps | null;
  formatRepairStatus: (status: string) => string;
  reviewPriorityColor: (bucket: ReviewPriorityBucket) => "default" | "error" | "warning";
  formatReviewPriority: (bucket: ReviewPriorityBucket) => string;
};

export function RepairWorkspaceContentPanel({
  userRole,
  repairLoading,
  selectedRepair,
  selectedReviewItem,
  isEditingRepair,
  saveRepairLoading,
  hasRepairDraft,
  repairExportLoading,
  repairArchiveLoading,
  repairDeleteLoading,
  onCancelEdit,
  onSaveRepair,
  onExportRepair,
  onStartEdit,
  onArchiveRepair,
  onDeleteRepair,
  reviewDecisionProps,
  repairTabsProps,
  formatRepairStatus,
  reviewPriorityColor,
  formatReviewPriority,
}: RepairWorkspaceContentPanelProps) {
  if (repairLoading) {
    return (
      <Stack spacing={2} alignItems="center" className="repair-placeholder">
        <CircularProgress size={28} />
        <Typography className="muted-copy">Загрузка карточки ремонта...</Typography>
      </Stack>
    );
  }

  if (!selectedRepair) {
    return (
      <Stack spacing={2} alignItems="center" className="repair-placeholder">
        <Typography className="muted-copy">Выберите документ, чтобы открыть карточку ремонта.</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" label={formatRepairStatus(selectedRepair.status)} />
          {selectedReviewItem ? (
            <Chip
              size="small"
              color={reviewPriorityColor(selectedReviewItem.priority_bucket)}
              label={formatReviewPriority(selectedReviewItem.priority_bucket)}
            />
          ) : null}
        </Stack>
        {userRole === "admin" ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {isEditingRepair ? (
              <>
                <Button variant="outlined" onClick={onCancelEdit} disabled={saveRepairLoading}>
                  Отмена
                </Button>
                <Button variant="contained" onClick={onSaveRepair} disabled={saveRepairLoading || !hasRepairDraft}>
                  {saveRepairLoading ? "Сохранение..." : "Сохранить"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outlined" onClick={onExportRepair} disabled={repairExportLoading}>
                  {repairExportLoading ? "Экспорт..." : "Экспорт Excel"}
                </Button>
                {selectedRepair.status !== "archived" ? (
                  <>
                    <Button variant="outlined" onClick={onStartEdit}>
                      Редактировать
                    </Button>
                    <Button variant="text" disabled={repairArchiveLoading} onClick={onArchiveRepair}>
                      {repairArchiveLoading ? "Архивация..." : "В архив"}
                    </Button>
                  </>
                ) : null}
                <Button variant="text" color="error" disabled={repairDeleteLoading} onClick={() => onDeleteRepair(selectedRepair.id)}>
                  {repairDeleteLoading ? "Удаление..." : "Удалить"}
                </Button>
              </>
            )}
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button variant="outlined" onClick={onExportRepair} disabled={repairExportLoading}>
              {repairExportLoading ? "Экспорт..." : "Экспорт Excel"}
            </Button>
          </Stack>
        )}
      </Stack>

      {reviewDecisionProps ? <ReviewDecisionPanel {...reviewDecisionProps} /> : null}
      {repairTabsProps ? <RepairTabsPanel {...repairTabsProps} /> : null}
    </Stack>
  );
}
