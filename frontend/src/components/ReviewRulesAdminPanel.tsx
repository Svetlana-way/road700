import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ReviewRuleItem } from "../shared/workspaceBootstrapTypes";
import type { ReviewRuleFormState } from "../shared/workspaceFormTypes";

type ReviewRulesAdminPanelProps = {
  showReviewRuleEditor: boolean;
  reviewRuleForm: ReviewRuleFormState;
  reviewRuleSaving: boolean;
  reviewRules: ReviewRuleItem[];
  reviewRuleTypes: string[];
  showReviewRuleListDialog: boolean;
  onToggleEditor: () => void;
  onReviewRuleFormChange: (field: keyof ReviewRuleFormState, value: string) => void;
  onSaveReviewRule: () => void;
  onResetReviewRuleEditor: () => void;
  onOpenListDialog: () => void;
  onCloseListDialog: () => void;
  onEditReviewRule: (item: ReviewRuleItem) => void;
  formatReviewRuleTypeLabel: (value: string) => string;
  formatReviewBucketLabel: (value: string | null | undefined) => string;
};

export function ReviewRulesAdminPanel({
  showReviewRuleEditor,
  reviewRuleForm,
  reviewRuleSaving,
  reviewRules,
  reviewRuleTypes,
  showReviewRuleListDialog,
  onToggleEditor,
  onReviewRuleFormChange,
  onSaveReviewRule,
  onResetReviewRuleEditor,
  onOpenListDialog,
  onCloseListDialog,
  onEditReviewRule,
  formatReviewRuleTypeLabel,
  formatReviewBucketLabel,
}: ReviewRulesAdminPanelProps) {
  const defaultRuleTypes = ["manual_review_reason", "document_status", "repair_status", "check_severity", "signal"];

  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Правила OCR и очереди проверки</Typography>
          <Typography className="muted-copy">
            Настройка причин ручной проверки, весов приоритета и группы приоритета без участия разработчика.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant={showReviewRuleEditor ? "outlined" : "contained"} onClick={onToggleEditor}>
            {showReviewRuleEditor ? "Скрыть форму правила" : "Добавить правило"}
          </Button>
        </Stack>
        {showReviewRuleEditor ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Создание и редактирование правила</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Тип правила"
                    value={reviewRuleForm.rule_type}
                    onChange={(event) => onReviewRuleFormChange("rule_type", event.target.value)}
                    fullWidth
                    disabled={reviewRuleForm.id !== null}
                  >
                    {defaultRuleTypes
                      .filter((item, index, array) => array.indexOf(item) === index)
                      .map((item) => (
                        <MenuItem key={item} value={item}>
                          {formatReviewRuleTypeLabel(item)}
                        </MenuItem>
                      ))}
                    {reviewRuleTypes
                      .filter((item) => !defaultRuleTypes.includes(item))
                      .map((item) => (
                        <MenuItem key={item} value={item}>
                          {formatReviewRuleTypeLabel(item)}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Код"
                    value={reviewRuleForm.code}
                    onChange={(event) => onReviewRuleFormChange("code", event.target.value)}
                    fullWidth
                    disabled={reviewRuleForm.id !== null}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название"
                    value={reviewRuleForm.title}
                    onChange={(event) => onReviewRuleFormChange("title", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Вес"
                    type="number"
                    value={reviewRuleForm.weight}
                    onChange={(event) => onReviewRuleFormChange("weight", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Группа приоритета"
                    value={reviewRuleForm.bucket_override}
                    onChange={(event) => onReviewRuleFormChange("bucket_override", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="">Без переопределения</MenuItem>
                    <MenuItem value="review">Обычный</MenuItem>
                    <MenuItem value="critical">Критичный</MenuItem>
                    <MenuItem value="suspicious">Подозрительный</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Активность"
                    value={reviewRuleForm.is_active}
                    onChange={(event) => onReviewRuleFormChange("is_active", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="true">Активно</MenuItem>
                    <MenuItem value="false">Отключено</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Порядок"
                    type="number"
                    value={reviewRuleForm.sort_order}
                    onChange={(event) => onReviewRuleFormChange("sort_order", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Примечание"
                    value={reviewRuleForm.notes}
                    onChange={(event) => onReviewRuleFormChange("notes", event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={reviewRuleSaving} onClick={onSaveReviewRule}>
                  {reviewRuleSaving ? "Сохранение..." : reviewRuleForm.id ? "Сохранить правило" : "Создать правило"}
                </Button>
                <Button variant="text" disabled={reviewRuleSaving} onClick={onResetReviewRuleEditor}>
                  Сбросить форму
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        <Typography className="muted-copy">В справочнике правил {reviewRules.length} записей.</Typography>
        {reviewRules.length > 0 ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Button variant="outlined" onClick={onOpenListDialog}>
              Открыть список правил
            </Button>
            <Typography className="muted-copy">Полный список правил скрыт с основной страницы.</Typography>
          </Stack>
        ) : (
          <Typography className="muted-copy">Правила пока не загружены.</Typography>
        )}
        <Dialog open={showReviewRuleListDialog} onClose={onCloseListDialog} fullWidth maxWidth="lg">
          <DialogTitle>Правила OCR и очереди проверки</DialogTitle>
          <DialogContent dividers>
            {reviewRules.length > 0 ? (
              <Stack spacing={1}>
                {reviewRules.map((item) => (
                  <Paper className="repair-line" key={`review-rule-${item.id}`} elevation={0}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography>{item.title}</Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip
                            size="small"
                            color={item.is_active ? "success" : "default"}
                            label={item.is_active ? "Активно" : "Отключено"}
                          />
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`${formatReviewRuleTypeLabel(item.rule_type)}: ${item.code}`}
                          />
                        </Stack>
                      </Stack>
                      <Typography className="muted-copy">
                        Вес {item.weight}
                        {item.bucket_override ? ` · группа ${formatReviewBucketLabel(item.bucket_override)}` : ""}
                        {` · порядок ${item.sort_order}`}
                      </Typography>
                      {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            onCloseListDialog();
                            onEditReviewRule(item);
                          }}
                        >
                          Редактировать
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">Правила пока не загружены.</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
}
