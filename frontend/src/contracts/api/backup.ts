export type BackupItem = {
  backup_id: string;
  filename: string;
  created_at: string;
  backup_type: string;
  source: string;
  status: string;
  size_bytes: number;
  storage_files_total: number;
  tables_total: number;
  included_sections: Array<"database" | "storage_files">;
  excluded_sections: Array<"backup_archives">;
  restore_effects: Array<"replace_database" | "replace_storage_files" | "keep_backup_archives" | "relogin_required">;
};

export type BackupListResponse = {
  items: BackupItem[];
  total: number;
};

export type BackupCreateResponse = {
  message: string;
  backup: BackupItem;
};

export type BackupRestoreResponse = {
  message: string;
  backup: BackupItem;
  requires_reauthentication: boolean;
  post_restore_action: "relogin";
};
