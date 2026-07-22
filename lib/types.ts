export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type RatingLabel = "Good" | "Average" | "Bad";
export type Severity = "Low" | "Medium" | "High";
export type TestCaseStatus = "draft" | "generated" | "reviewed";
export type CaseType = "normal" | "edge" | "ambiguous" | "missing_context" | "adversarial" | "tone_sensitive";
export type PromptVariableType = "text" | "long_text" | "number" | "boolean" | "select";

export type PromptVariable = {
  key: string;
  label: string;
  type: PromptVariableType;
  required: boolean;
  default_value: string | number | boolean | null;
  description: string | null;
  options: string[];
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  product_type: string;
  goal: string;
  target_user: string;
  description: string | null;
  variables: string[];
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
};

export type PromptVersion = {
  id: string;
  project_id: string;
  version_number: number;
  system_prompt: string;
  model_used: string;
  notes: string | null;
  is_active: boolean;
  variable_schema: PromptVariable[];
  created_at: string;
};

export type EvaluationCriterion = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  good_definition: string;
  average_definition: string;
  bad_definition: string;
  category: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TestCase = {
  id: string;
  project_id: string;
  user_input: string;
  case_type: CaseType | null;
  variable_values: Record<string, string | number | boolean | null>;
  generated_ai_output: string | null;
  prompt_version_id: string | null;
  model_used: string | null;
  status: TestCaseStatus;
  created_at: string;
  updated_at: string;
};

export type HumanReview = {
  id: string;
  project_id: string;
  test_case_id: string;
  failure_category: string | null;
  severity: Severity | null;
  human_notes: string | null;
  reviewed_at: string;
};

export type HumanReviewRating = {
  id: string;
  review_id: string;
  criterion_id: string;
  rating_label: RatingLabel;
  rating_score: number;
};

export type ErrorAnalysisReport = {
  id: string;
  project_id: string;
  prompt_version_id: string | null;
  summary: Record<string, unknown>;
  created_at: string;
};
