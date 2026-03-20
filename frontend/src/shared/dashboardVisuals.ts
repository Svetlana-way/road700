type DashboardSummaryLike = {
  repairs_total: number;
  repairs_draft: number;
  documents_review_queue: number;
};

type DashboardDataQualityLike = {
  documents_low_confidence: number;
  documents_needs_review: number;
  documents_ocr_error: number;
  import_conflicts_pending: number;
  repairs_suspicious: number;
};

type DashboardDataQualityDetailsLike = {
  counts: {
    documents: number;
    services: number;
    works: number;
    parts: number;
    conflicts: number;
  };
};

export type DashboardVisualTone = "blue" | "amber" | "red" | "green";

export type DashboardVisualBar = {
  label: string;
  value: number;
  hint?: string;
  tone: DashboardVisualTone;
};

export function buildDashboardVisualBarWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }
  const ratio = (value / maxValue) * 100;
  return `${Math.max(8, Math.min(100, ratio))}%`;
}

export function buildRepairVisualBars(
  summary: DashboardSummaryLike | null,
  dataQuality: DashboardDataQualityLike | null,
): DashboardVisualBar[] {
  if (!summary) {
    return [];
  }

  const confirmedRepairs = Math.max(
    0,
    summary.repairs_total - summary.repairs_draft - (dataQuality?.repairs_suspicious || 0),
  );

  const items: DashboardVisualBar[] = [
    {
      label: "Подтверждено",
      value: confirmedRepairs,
      hint: "Ремонты без открытой подозрительности",
      tone: "green",
    },
    {
      label: "Черновики",
      value: summary.repairs_draft,
      hint: "Ещё не подтверждены",
      tone: "amber",
    },
    {
      label: "Подозрительные",
      value: dataQuality?.repairs_suspicious || 0,
      hint: "Требуют проверки",
      tone: "red",
    },
    {
      label: "Документы в очереди",
      value: summary.documents_review_queue,
      hint: "Ожидают OCR или ручной разбор",
      tone: "blue",
    },
  ];

  return items.filter((item) => item.value > 0);
}

export function buildQualityVisualBars(dataQuality: DashboardDataQualityLike | null): DashboardVisualBar[] {
  if (!dataQuality) {
    return [];
  }

  const items: DashboardVisualBar[] = [
    {
      label: "Низкая уверенность OCR",
      value: dataQuality.documents_low_confidence,
      hint: "Ниже рабочего порога",
      tone: "amber",
    },
    {
      label: "Документы на проверке",
      value: dataQuality.documents_needs_review,
      hint: "Нужен ручной разбор",
      tone: "blue",
    },
    {
      label: "Ошибки OCR",
      value: dataQuality.documents_ocr_error,
      hint: "Распознавание не удалось",
      tone: "red",
    },
    {
      label: "Конфликты импорта",
      value: dataQuality.import_conflicts_pending,
      hint: "История ждёт сверки",
      tone: "amber",
    },
  ];

  return items.filter((item) => item.value > 0);
}

export function buildAttentionVisualBars(details: DashboardDataQualityDetailsLike | null): DashboardVisualBar[] {
  if (!details) {
    return [];
  }

  const items: DashboardVisualBar[] = [
    {
      label: "Документы",
      value: details.counts.documents,
      hint: "Проблемные файлы",
      tone: "blue",
    },
    {
      label: "Сервисы",
      value: details.counts.services,
      hint: "Неподтверждённые контрагенты",
      tone: "amber",
    },
    {
      label: "Работы",
      value: details.counts.works,
      hint: "Строки без нормализации",
      tone: "amber",
    },
    {
      label: "Материалы",
      value: details.counts.parts,
      hint: "Строки без подтверждения",
      tone: "amber",
    },
    {
      label: "Конфликты",
      value: details.counts.conflicts,
      hint: "Не разобран импорт",
      tone: "red",
    },
  ];

  return items.filter((item) => item.value > 0);
}
