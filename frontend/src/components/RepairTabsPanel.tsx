import { type ComponentProps } from "react";
import { Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { RepairDocumentsSection } from "./RepairDocumentsSection";
import { RepairEditSections } from "./RepairEditSections";
import { RepairOverviewReportPanel } from "./RepairOverviewReportPanel";
import { RepairReadOnlySections } from "./RepairReadOnlySections";

type RepairTab = "overview" | "works" | "parts" | "documents" | "checks" | "history";

type RepairOverviewProps = ComponentProps<typeof RepairOverviewReportPanel>;
type RepairDocumentsProps = ComponentProps<typeof RepairDocumentsSection>;
type RepairReadOnlyProps = ComponentProps<typeof RepairReadOnlySections>;
type RepairEditProps = ComponentProps<typeof RepairEditSections>;

type RepairTabsPanelProps = {
  activeRepairTab: RepairTab;
  repairTabDescriptions: Record<RepairTab, string>;
  isEditingRepair: boolean;
  selectedRepair: RepairOverviewProps["selectedRepair"] & RepairDocumentsProps["selectedRepair"] & RepairReadOnlyProps["selectedRepair"];
  editProps: RepairEditProps | null;
  overviewProps: RepairOverviewProps;
  documentsProps: RepairDocumentsProps;
  readOnlyProps: RepairReadOnlyProps;
  onRepairTabChange: (value: RepairTab) => void;
};

export function RepairTabsPanel({
  activeRepairTab,
  repairTabDescriptions,
  isEditingRepair,
  selectedRepair,
  editProps,
  overviewProps,
  documentsProps,
  readOnlyProps,
  onRepairTabChange,
}: RepairTabsPanelProps) {
  return (
    <>
      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.25}>
          <Tabs
            value={activeRepairTab}
            onChange={(_event, value: RepairTab) => onRepairTabChange(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label="Итоги" value="overview" />
            <Tab label={`Работы · ${selectedRepair.works.length}`} value="works" />
            <Tab label={`Запчасти · ${selectedRepair.parts.length}`} value="parts" />
            {!isEditingRepair ? <Tab label={`Документы · ${selectedRepair.documents.length}`} value="documents" /> : null}
            {!isEditingRepair ? <Tab label={`Проверки · ${selectedRepair.checks.length}`} value="checks" /> : null}
            {!isEditingRepair ? (
              <Tab
                label={`История · ${readOnlyProps.filteredDocumentHistory.length + readOnlyProps.filteredRepairHistory.length}`}
                value="history"
              />
            ) : null}
          </Tabs>
          <Typography className="muted-copy">{repairTabDescriptions[activeRepairTab]}</Typography>
        </Stack>
      </Paper>

      {isEditingRepair && editProps ? (
        <RepairEditSections {...editProps} />
      ) : (
        <>
          {activeRepairTab === "overview" ? <RepairOverviewReportPanel {...overviewProps} /> : null}
          {activeRepairTab === "documents" ? <RepairDocumentsSection {...documentsProps} /> : null}
          <RepairReadOnlySections {...readOnlyProps} />
        </>
      )}
    </>
  );
}
