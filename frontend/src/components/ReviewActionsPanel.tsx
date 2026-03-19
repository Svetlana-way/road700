import { Button, Stack, TextField } from "@mui/material";

type UserRole = "admin" | "employee";

type ReviewActionsPanelProps = {
  userRole: UserRole | undefined;
  reviewActionComment: string;
  reviewActionLoading: boolean;
  reviewServiceAssigning: boolean;
  reviewServiceSaving: boolean;
  reviewFieldSaving: boolean;
  reviewVehicleLinking: boolean;
  canConfirmSelectedReview: boolean;
  onCommentChange: (value: string) => void;
  onConfirm: () => void;
  onSendToReview: () => void;
};

export function ReviewActionsPanel({
  userRole,
  reviewActionComment,
  reviewActionLoading,
  reviewServiceAssigning,
  reviewServiceSaving,
  reviewFieldSaving,
  reviewVehicleLinking,
  canConfirmSelectedReview,
  onCommentChange,
  onConfirm,
  onSendToReview,
}: ReviewActionsPanelProps) {
  const confirmDisabled =
    reviewActionLoading ||
    reviewServiceAssigning ||
    reviewServiceSaving ||
    reviewFieldSaving ||
    reviewVehicleLinking ||
    !canConfirmSelectedReview;
  const returnDisabled =
    reviewActionLoading || reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinking;

  return (
    <>
      <TextField
        label={userRole === "admin" ? "Комментарий администратора" : "Комментарий сотрудника"}
        value={reviewActionComment}
        onChange={(event) => onCommentChange(event.target.value)}
        fullWidth
        multiline
        minRows={2}
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" disabled={confirmDisabled} onClick={onConfirm}>
          {reviewActionLoading ? "Сохранение..." : userRole === "admin" ? "Подтвердить админом" : "Подтвердить сотрудником"}
        </Button>
        <Button variant="outlined" disabled={returnDisabled} onClick={onSendToReview}>
          Вернуть в ручную проверку
        </Button>
      </Stack>
    </>
  );
}
