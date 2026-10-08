export interface CertificateEnv {
  requestId?: string;
}
export interface CertificateRow {
  id: string;
  credential_id: string;
  supersedes_id: string | null;
  user_id: string;
  certificate_type: "course_completion" | "role_readiness";
  status: "pending_name" | "issued" | "revoked";
  level_id: string | null;
  role_id: string | null;
  learning_path_id: string | null;
  level_progress_id: string | null;
  learner_name: string | null;
  title: string;
  subtitle: string | null;
  level_label: string | null;
  badge: "developing" | "skilled" | "mastery" | null;
  completion_date: string;
  metadata: Record<string, unknown>;
  issued_at: string | null;
  pdf_object_key: string | null;
  pdf_template_version: number | null;
  pdf_generated_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  revoked_by: string | null;
  created_at: string;
  updated_at: string;
}
export interface IssueResult {
  certificateId: string;
  credentialId: string;
  status: CertificateRow["status"];
  created: boolean;
}
