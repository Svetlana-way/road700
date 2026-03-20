import { type ComponentProps } from "react";
import { AdminWorkspacePanel } from "./AdminWorkspacePanel";
import { BackupsAdminPanel } from "./BackupsAdminPanel";
import { EmployeesAdminPanel } from "./EmployeesAdminPanel";
import { HistoricalImportsAdminPanel } from "./HistoricalImportsAdminPanel";
import { LaborNormsAdminPanel } from "./LaborNormsAdminPanel";
import { OcrLearningAdminPanel } from "./OcrLearningAdminPanel";
import { OcrMatchersAdminPanel } from "./OcrMatchersAdminPanel";
import { OcrRulesAdminPanel } from "./OcrRulesAdminPanel";
import { ReviewRulesAdminPanel } from "./ReviewRulesAdminPanel";
import { ServicesAdminPanel } from "./ServicesAdminPanel";
import { TechAdminWorkspacePanel } from "./TechAdminWorkspacePanel";

type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";
type AdminTab = "services" | "control" | "labor_norms" | "imports" | "employees" | "backups";
type TechAdminTab = "learning" | "matchers" | "rules";
type UserRole = "admin" | "employee";

type WorkspaceAdminPanelsProps = {
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  activeTechAdminTab: TechAdminTab;
  userRole: UserRole | undefined;
  adminWorkspaceProps: ComponentProps<typeof AdminWorkspacePanel>;
  techAdminWorkspaceProps: ComponentProps<typeof TechAdminWorkspacePanel>;
  employeesProps: ComponentProps<typeof EmployeesAdminPanel>;
  servicesProps: ComponentProps<typeof ServicesAdminPanel>;
  backupsProps: ComponentProps<typeof BackupsAdminPanel>;
  reviewRulesProps: ComponentProps<typeof ReviewRulesAdminPanel>;
  ocrLearningProps: ComponentProps<typeof OcrLearningAdminPanel>;
  ocrMatchersProps: ComponentProps<typeof OcrMatchersAdminPanel>;
  ocrRulesProps: ComponentProps<typeof OcrRulesAdminPanel>;
  historicalImportsProps: ComponentProps<typeof HistoricalImportsAdminPanel>;
  laborNormsProps: ComponentProps<typeof LaborNormsAdminPanel>;
};

export function WorkspaceAdminPanels({
  activeWorkspaceTab,
  activeAdminTab,
  activeTechAdminTab,
  userRole,
  adminWorkspaceProps,
  techAdminWorkspaceProps,
  employeesProps,
  servicesProps,
  backupsProps,
  reviewRulesProps,
  ocrLearningProps,
  ocrMatchersProps,
  ocrRulesProps,
  historicalImportsProps,
  laborNormsProps,
}: WorkspaceAdminPanelsProps) {
  if (userRole !== "admin") {
    return null;
  }

  return (
    <>
      {activeWorkspaceTab === "admin" ? <AdminWorkspacePanel {...adminWorkspaceProps} /> : null}
      {activeWorkspaceTab === "tech_admin" ? <TechAdminWorkspacePanel {...techAdminWorkspaceProps} /> : null}

      {activeWorkspaceTab === "admin" && activeAdminTab === "employees" ? <EmployeesAdminPanel {...employeesProps} /> : null}
      {activeWorkspaceTab === "admin" && activeAdminTab === "services" ? <ServicesAdminPanel {...servicesProps} /> : null}
      {activeWorkspaceTab === "admin" && activeAdminTab === "backups" ? <BackupsAdminPanel {...backupsProps} /> : null}
      {activeWorkspaceTab === "admin" && activeAdminTab === "control" ? <ReviewRulesAdminPanel {...reviewRulesProps} /> : null}
      {activeWorkspaceTab === "admin" && activeAdminTab === "imports" ? (
        <HistoricalImportsAdminPanel {...historicalImportsProps} />
      ) : null}
      {activeWorkspaceTab === "admin" && activeAdminTab === "labor_norms" ? <LaborNormsAdminPanel {...laborNormsProps} /> : null}

      {activeWorkspaceTab === "tech_admin" && activeTechAdminTab === "learning" ? (
        <OcrLearningAdminPanel {...ocrLearningProps} />
      ) : null}
      {activeWorkspaceTab === "tech_admin" && activeTechAdminTab === "matchers" ? (
        <OcrMatchersAdminPanel {...ocrMatchersProps} />
      ) : null}
      {activeWorkspaceTab === "tech_admin" && activeTechAdminTab === "rules" ? <OcrRulesAdminPanel {...ocrRulesProps} /> : null}
    </>
  );
}
