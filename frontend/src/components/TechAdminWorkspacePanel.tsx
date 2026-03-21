import { Alert, Box, Button, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";

type TechAdminTab = "learning" | "matchers" | "rules";

type TechAdminWorkspacePanelProps = {
  activeTechAdminTab: TechAdminTab;
  description: string;
  isPasswordRecoveryEmailConfigured: boolean;
  ocrBackend: "vision" | "tesseract" | null | undefined;
  pdfRenderer: "pdftoppm" | "sips" | null | undefined;
  isImageOcrAvailable: boolean;
  isPdfScanOcrAvailable: boolean;
  onTechAdminTabChange: (value: TechAdminTab) => void;
  onCloseTechAdmin: () => void;
};

export function TechAdminWorkspacePanel({
  activeTechAdminTab,
  description,
  isPasswordRecoveryEmailConfigured,
  ocrBackend,
  pdfRenderer,
  isImageOcrAvailable,
  isPdfScanOcrAvailable,
  onTechAdminTabChange,
  onCloseTechAdmin,
}: TechAdminWorkspacePanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Box>
            <Typography variant="h5">Техническая админка</Typography>
            <Typography className="muted-copy">
              Отдельный экран для OCR-обучения, выбора шаблонов и правил извлечения полей.
            </Typography>
          </Box>
          <Button variant="outlined" onClick={onCloseTechAdmin}>
            Вернуться в админку
          </Button>
        </Stack>
        <Tabs
          value={activeTechAdminTab}
          onChange={(_event, value: TechAdminTab) => onTechAdminTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Обучение OCR" value="learning" />
          <Tab label="Выбор шаблона" value="matchers" />
          <Tab label="Извлечение полей" value="rules" />
        </Tabs>
        <Typography className="muted-copy">{description}</Typography>
        <Alert severity={isPasswordRecoveryEmailConfigured ? "success" : "warning"}>
          {isPasswordRecoveryEmailConfigured
            ? "Письма для восстановления пароля отправляются автоматически."
            : "Письма для восстановления пароля пока не настроены. Сейчас система работает в ручном режиме."}
        </Alert>
        <Alert severity={isPdfScanOcrAvailable ? "success" : isImageOcrAvailable ? "warning" : "error"}>
          {isPdfScanOcrAvailable
            ? `OCR готов к production: backend ${ocrBackend || "не определен"}, PDF renderer ${pdfRenderer || "не определен"}.`
            : isImageOcrAvailable
              ? `OCR для изображений доступен через ${ocrBackend || "не определен"}, но OCR PDF-сканов ограничен: renderer ${pdfRenderer || "не найден"}.`
              : "OCR backend не найден. Фото и сканы не будут распознаваться автоматически."}
        </Alert>
      </Stack>
    </Paper>
  );
}
