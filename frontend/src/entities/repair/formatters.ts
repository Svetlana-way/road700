import type { CheckSeverity } from "../../shared/workspaceViewTypes";
import { formatStatus } from "../../shared/formattersCore";

export type ReviewPriorityBucketFormatter = "review" | "critical" | "suspicious";

const repairStatusLabels: Record<string, string> = {
  draft: "Черновик",
  in_review: "На проверке",
  employee_confirmed: "Подтверждён сотрудником",
  suspicious: "Подозрительный",
  confirmed: "Подтверждён",
  partially_recognized: "Частично распознан",
  ocr_error: "Ошибка OCR",
  archived: "Архивный",
};

export function formatRepairStatus(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return repairStatusLabels[status] || formatStatus(status);
}

export function checkSeverityColor(severity: CheckSeverity): "default" | "success" | "error" | "warning" {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning" || severity === "suspicious") {
    return "warning";
  }
  if (severity === "normal") {
    return "success";
  }
  return "default";
}

export function executiveRiskColor(level: "low" | "medium" | "high"): "success" | "warning" | "error" {
  if (level === "high") {
    return "error";
  }
  if (level === "medium") {
    return "warning";
  }
  return "success";
}

export function formatExecutiveRiskLabel(level: "low" | "medium" | "high") {
  if (level === "high") {
    return "Высокий риск";
  }
  if (level === "medium") {
    return "Средний риск";
  }
  return "Низкий риск";
}

export function reviewPriorityColor(bucket: ReviewPriorityBucketFormatter): "default" | "error" | "warning" {
  if (bucket === "suspicious") {
    return "error";
  }
  if (bucket === "critical") {
    return "warning";
  }
  return "default";
}

export function formatReviewPriority(bucket: ReviewPriorityBucketFormatter) {
  if (bucket === "suspicious") {
    return "Подозрительно";
  }
  if (bucket === "critical") {
    return "Критично";
  }
  return "Проверить";
}
