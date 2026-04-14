import { formatStatus } from "../../shared/formattersCore";

const historyActionLabels: Record<string, string> = {
  manual_update: "Ручное редактирование ремонта",
  repair_archived: "Ремонт отправлен в архив",
  repair_deleted: "Заказ-наряд удалён",
  service_assignment: "Назначение сервиса",
  review_field_update: "Обновление полей проверки",
  check_resolution_update: "Изменение статуса проверки",
  review_employee_confirm: "Подтверждение сотрудником",
  review_confirm: "Подтверждение администратором",
  review_send_to_review: "Возврат в ручную проверку",
  primary_document_changed: "Смена основного документа",
  set_primary: "Документ назначен основным",
  document_uploaded: "Загрузка нового документа",
  document_attached: "Прикрепление документа к ремонту",
  document_processing_queued: "Документ отправлен на перепроверку",
  document_archived: "Документ отправлен в архив",
  document_restored: "Документ восстановлен из архива",
  document_status_updated: "Изменение статуса документа",
  document_comparison_reviewed: "Результат сверки документов",
  repair_vehicle_relinked: "Перепривязка ремонта к технике",
  document_vehicle_linked: "Привязка документа к технике",
  vehicle_created_from_document: "Карточка техники создана из документа",
  comparison_keep_current_primary: "Сверка: оставлен текущий основной документ",
  comparison_make_document_primary: "Сверка: выбран новый основной документ",
  comparison_mark_reviewed: "Сверка отмечена как проверенная",
  historical_import_created: "Исторический ремонт загружен",
  backup_created: "Резервная копия создана",
  backup_restored: "Резервная копия восстановлена",
  user_created: "Пользователь создан",
  user_updated: "Пользователь обновлён",
  user_password_reset: "Пароль пользователя сброшен администратором",
  user_password_changed: "Пользователь сменил пароль",
  user_password_recovery_requested: "Запрошено восстановление пароля",
  user_password_recovered: "Пароль восстановлен",
  user_assignment_created: "Назначение техники пользователю",
  user_assignment_updated: "Изменение назначения техники пользователю",
  vehicle_updated: "Карточка техники обновлена",
  service_created: "Сервис создан",
  service_updated: "Сервис обновлён",
  service_archived: "Сервис отправлен в архив",
  service_restored: "Сервис восстановлен из архива",
  repair_restored: "Ремонт восстановлен из архива",
  import_conflict_resolved: "Конфликт импорта разрешён",
  labor_norm_catalog_created: "Каталог нормо-часов создан",
  labor_norm_catalog_updated: "Каталог нормо-часов обновлён",
  labor_norm_catalog_archived: "Каталог нормо-часов отправлен в архив",
  labor_norm_import_succeeded: "Импорт нормо-часов завершён",
  labor_norm_import_failed: "Импорт нормо-часов завершился ошибкой",
  labor_norm_item_created: "Нормо-час создан",
  labor_norm_item_updated: "Нормо-час обновлён",
  labor_norm_item_archived: "Нормо-час отправлен в архив",
};

const auditEntityLabels: Record<string, string> = {
  repair: "Ремонт",
  document: "Документ",
  vehicle: "Техника",
  service: "Сервис",
  user: "Пользователь",
  labor_norm_catalog_item: "Нормо-час",
  labor_norm_catalog_config: "Каталог нормо-часов",
  labor_norm_catalog: "Каталог нормо-часов",
  labor_norm_item: "Нормо-час",
  labor_norm_import: "Импорт нормо-часов",
  review_rule: "Правило проверки",
  ocr_rule: "OCR правило",
  ocr_profile_matcher: "OCR подбор профиля",
  ocr_learning_signal: "OCR сигнал обучения",
  import_conflict: "Конфликт импорта",
  system: "Система",
};

export function formatAuditEntityLabel(entityType: string | null | undefined) {
  if (!entityType) {
    return "Сущность";
  }
  return auditEntityLabels[entityType] || formatStatus(entityType);
}

export function formatHistoryActionLabel(actionType: string) {
  return historyActionLabels[actionType] || formatStatus(actionType);
}
