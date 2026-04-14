export type AuditLogItem = {
  id: number;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
  action_types: string[];
  entity_types: string[];
};
