import type { AdminTab, RepairTab, TechAdminTab, WorkspaceTab } from "./appRoute";

type DashboardSummaryKey =
  | "vehicles_total"
  | "repairs_total"
  | "documents_total"
  | "documents_review_queue";

type DashboardDataQualityKey =
  | "documents_needs_review"
  | "documents_ocr_error"
  | "documents_low_confidence"
  | "repairs_suspicious"
  | "services_preliminary"
  | "works_preliminary"
  | "parts_preliminary"
  | "import_conflicts_pending";

type ReviewQueueCategory =
  | "all"
  | "suspicious"
  | "ocr_error"
  | "partial_recognition"
  | "employee_confirmation"
  | "manual_review";

type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";

export const summaryCards: Array<{ key: DashboardSummaryKey; label: string }> = [
  { key: "vehicles_total", label: "Техника в доступе" },
  { key: "repairs_total", label: "Ремонтов в базе" },
  { key: "documents_total", label: "Документов загружено" },
  { key: "documents_review_queue", label: "Очередь проверки" },
];

export const qualityCards: Array<{ key: DashboardDataQualityKey; label: string }> = [
  { key: "documents_needs_review", label: "Документы на проверке" },
  { key: "documents_ocr_error", label: "Ошибки OCR" },
  { key: "documents_low_confidence", label: "Низкая уверенность OCR" },
  { key: "repairs_suspicious", label: "Подозрительные ремонты" },
  { key: "services_preliminary", label: "Неподтверждённые сервисы" },
  { key: "works_preliminary", label: "Неподтверждённые работы" },
  { key: "parts_preliminary", label: "Неподтверждённые материалы" },
  { key: "import_conflicts_pending", label: "Конфликты импорта" },
];

export const workspaceTabDescriptions: Record<WorkspaceTab, string> = {
  documents: "Загрузка заказ-наряда, автоматическая проверка и короткий итог по результату.",
  repair: "Короткий итог по заказ-наряду, полная расшифровка проверки и история ремонта.",
  admin: "Справочники и правила системы, доступные администратору.",
  tech_admin: "Отдельный экран для OCR-обучения и тонкой технической настройки.",
  fleet: "Быстрый обзор техники, доступной текущему пользователю.",
  search: "Глобальный поиск по заказ-нарядам, ремонтам и карточкам техники.",
  audit: "Журнал действий по ремонтам, документам, технике и пользовательским операциям.",
};

export const workspaceTabReturnLabels: Record<WorkspaceTab, string> = {
  documents: "Назад к документам",
  repair: "Назад к ремонту",
  admin: "Назад в админку",
  tech_admin: "Назад в тех. админку",
  fleet: "Назад к технике",
  search: "Назад к поиску",
  audit: "Назад к журналу",
};

export const adminTabDescriptions: Record<AdminTab, string> = {
  services: "Справочник сервисов для нормализации названий и ручной правки ремонтов.",
  control: "Причины ручной проверки и приоритеты очереди для заказ-нарядов.",
  labor_norms: "Каталоги нормо-часов, импорт справочников и ручная правка записей.",
  imports: "Пакетный импорт исторических ремонтов из Excel с фиксацией конфликтов и созданием архивной базы.",
  employees: "Пользователи системы, доступ сотрудников и закрепление техники по зонам ответственности.",
  backups: "Полные резервные копии базы и файлов, ручной запуск backup и защищённое восстановление.",
};

export const techAdminTabDescriptions: Record<TechAdminTab, string> = {
  learning: "Сигналы из ручных исправлений, которые помогают улучшать OCR на реальных документах.",
  matchers: "Правила выбора шаблона OCR по файлу, сервису и текстовым признакам документа.",
  rules: "Правила извлечения полей из PDF, фото и сканов заказ-нарядов.",
};

export const repairTabDescriptions: Record<RepairTab, string> = {
  overview: "Короткий итог для руководителя и полная расшифровка проверки по кнопке.",
  works: "Список работ, нормо-часы и ручное редактирование работ.",
  parts: "Список запчастей и ручное редактирование материалов.",
  documents: "Документы ремонта, версии OCR и сравнение файлов.",
  checks: "Подозрительные проверки и их ручное закрытие.",
  history: "История изменений ремонта и документов.",
};

export const reviewQueueFilters: Array<{ key: ReviewQueueCategory; label: string }> = [
  { key: "all", label: "Все" },
  { key: "suspicious", label: "Подозрительные" },
  { key: "ocr_error", label: "OCR ошибки" },
  { key: "partial_recognition", label: "Частично распознано" },
  { key: "employee_confirmation", label: "Ждут подтверждения" },
  { key: "manual_review", label: "Ручная проверка" },
];

export const historyFilters: Array<{ key: HistoryFilter; label: string }> = [
  { key: "all", label: "Все события" },
  { key: "repair", label: "Ремонт" },
  { key: "documents", label: "Документы" },
  { key: "uploads", label: "Загрузки" },
  { key: "primary", label: "Основной документ" },
  { key: "comparison", label: "Сверки" },
];

export const documentKindOptions: Array<{ value: DocumentKind; label: string }> = [
  { value: "order", label: "Основной заказ-наряд" },
  { value: "repeat_scan", label: "Повторный скан" },
  { value: "attachment", label: "Приложение" },
  { value: "confirmation", label: "Подтверждающий файл" },
];

export const rootDocumentKindOptions = documentKindOptions.filter(
  (option) => option.value === "order" || option.value === "repeat_scan",
);

export const VEHICLES_FULL_LIST_LIMIT = 2000;
