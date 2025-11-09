export interface ScanResult {
  projectPath: string;
  framework: Framework | null;
  issues: Issue[];
  warnings: Warning[];
  passed: PassedCheck[];
  summary: Summary;
}

export interface Issue {
  id: string;
  severity: "error" | "warning" | "info";
  category: "port" | "host" | "start-command" | "env-vars" | "static-files" | "database";
  message: string;
  file?: string;
  line?: number;
  fix: FixSuggestion;
}

export interface Warning extends Omit<Issue, "severity"> {
  severity: "warning";
}

export interface PassedCheck {
  id: string;
  category: string;
  message: string;
}

export interface FixSuggestion {
  description: string;
  before?: string;  // Code before fix
  after?: string;   // Code after fix
  steps?: string[]; // Manual steps if code fix not applicable
}

export interface Framework {
  name: "express" | "nextjs" | "nestjs" | "django" | "flask" | "fastapi" | "unknown";
  version?: string;
  mainFile?: string; // Entry point file
}

export interface Summary {
  totalIssues: number;
  errors: number;
  warnings: number;
  passed: number;
  deploymentLikelihood: "will-fail" | "might-fail" | "should-succeed";
}

export interface CodeContext {
  filePath: string;
  lineNumber?: number;
  snippet?: string;
}
