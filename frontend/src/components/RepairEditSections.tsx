import { Button, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import type { EditablePartDraft, EditableRepairDraft, EditableWorkDraft } from "../shared/repairUiHelpers";

type RepairTab = "overview" | "works" | "parts" | "documents" | "checks" | "history";

type ServiceOption = {
  id: number;
  name: string;
};

type RepairEditSectionsProps = {
  activeRepairTab: RepairTab;
  repairDraft: EditableRepairDraft;
  services: ServiceOption[];
  onRepairFieldChange: <K extends keyof EditableRepairDraft>(field: K, value: EditableRepairDraft[K]) => void;
  onAddWorkDraft: () => void;
  onUpdateWorkDraft: <K extends keyof EditableWorkDraft>(index: number, field: K, value: EditableWorkDraft[K]) => void;
  onRemoveWorkDraft: (index: number) => void;
  onAddPartDraft: () => void;
  onUpdatePartDraft: <K extends keyof EditablePartDraft>(index: number, field: K, value: EditablePartDraft[K]) => void;
  onRemovePartDraft: (index: number) => void;
};

export function RepairEditSections({
  activeRepairTab,
  repairDraft,
  services,
  onRepairFieldChange,
  onAddWorkDraft,
  onUpdateWorkDraft,
  onRemoveWorkDraft,
  onAddPartDraft,
  onUpdatePartDraft,
  onRemovePartDraft,
}: RepairEditSectionsProps) {
  return (
    <Stack spacing={2}>
      {activeRepairTab === "overview" ? (
        <Paper className="repair-summary" elevation={0}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Заказ-наряд"
                value={repairDraft.order_number}
                onChange={(event) => onRepairFieldChange("order_number", event.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Сервис"
                value={repairDraft.service_name}
                onChange={(event) => onRepairFieldChange("service_name", event.target.value)}
                inputProps={{ list: "known-services-list" }}
                helperText={services.length > 0 ? "Выберите сервис из справочника, синхронизируемого из папки `Сервисы`." : undefined}
                fullWidth
              />
              <datalist id="known-services-list">
                {services.map((item) => (
                  <option key={`service-option-${item.id}`} value={item.name} />
                ))}
              </datalist>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                label="Дата ремонта"
                value={repairDraft.repair_date}
                onChange={(event) => onRepairFieldChange("repair_date", event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="number"
                label="Пробег"
                value={repairDraft.mileage}
                onChange={(event) => onRepairFieldChange("mileage", Number(event.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                type="number"
                label="Работы"
                value={repairDraft.work_total}
                onChange={(event) => onRepairFieldChange("work_total", Number(event.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                type="number"
                label="Запчасти"
                value={repairDraft.parts_total}
                onChange={(event) => onRepairFieldChange("parts_total", Number(event.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                type="number"
                label="НДС"
                value={repairDraft.vat_total}
                onChange={(event) => onRepairFieldChange("vat_total", Number(event.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                type="number"
                label="Итого"
                value={repairDraft.grand_total}
                onChange={(event) => onRepairFieldChange("grand_total", Number(event.target.value))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Причина ремонта"
                value={repairDraft.reason}
                onChange={(event) => onRepairFieldChange("reason", event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Комментарий сотрудника"
                value={repairDraft.employee_comment}
                onChange={(event) => onRepairFieldChange("employee_comment", event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      {activeRepairTab === "works" ? (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
            <Typography variant="h6">Работы</Typography>
            <Button size="small" variant="text" onClick={onAddWorkDraft}>
              Добавить работу
            </Button>
          </Stack>
          {repairDraft.works.map((item, index) => (
            <Paper className="repair-line" key={`work-${index}`} elevation={0}>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <TextField
                    label="Наименование работы"
                    value={item.work_name}
                    onChange={(event) => onUpdateWorkDraft(index, "work_name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Код"
                    value={item.work_code}
                    onChange={(event) => onUpdateWorkDraft(index, "work_code", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Кол-во"
                    value={item.quantity}
                    onChange={(event) => onUpdateWorkDraft(index, "quantity", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Нормо-часы"
                    value={item.standard_hours}
                    onChange={(event) =>
                      onUpdateWorkDraft(index, "standard_hours", event.target.value === "" ? "" : Number(event.target.value))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Факт-часы"
                    value={item.actual_hours}
                    onChange={(event) =>
                      onUpdateWorkDraft(index, "actual_hours", event.target.value === "" ? "" : Number(event.target.value))
                    }
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Цена"
                    value={item.price}
                    onChange={(event) => onUpdateWorkDraft(index, "price", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    type="number"
                    label="Сумма"
                    value={item.line_total}
                    onChange={(event) => onUpdateWorkDraft(index, "line_total", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button size="small" color="error" onClick={() => onRemoveWorkDraft(index)}>
                    Удалить работу
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
      ) : null}

      {activeRepairTab === "parts" ? (
        <Stack spacing={1}>
          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
            <Typography variant="h6">Запчасти</Typography>
            <Button size="small" variant="text" onClick={onAddPartDraft}>
              Добавить запчасть
            </Button>
          </Stack>
          {repairDraft.parts.map((item, index) => (
            <Paper className="repair-line" key={`part-${index}`} elevation={0}>
              <Grid container spacing={1.5}>
                <Grid item xs={12}>
                  <TextField
                    label="Наименование запчасти"
                    value={item.part_name}
                    onChange={(event) => onUpdatePartDraft(index, "part_name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Артикул"
                    value={item.article}
                    onChange={(event) => onUpdatePartDraft(index, "article", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    label="Ед. изм."
                    value={item.unit_name}
                    onChange={(event) => onUpdatePartDraft(index, "unit_name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Кол-во"
                    value={item.quantity}
                    onChange={(event) => onUpdatePartDraft(index, "quantity", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Цена"
                    value={item.price}
                    onChange={(event) => onUpdatePartDraft(index, "price", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={4}>
                  <TextField
                    type="number"
                    label="Сумма"
                    value={item.line_total}
                    onChange={(event) => onUpdatePartDraft(index, "line_total", Number(event.target.value))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button size="small" color="error" onClick={() => onRemovePartDraft(index)}>
                    Удалить запчасть
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
