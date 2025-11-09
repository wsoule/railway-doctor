import { join } from "path";
import { detectFramework } from "./fileDetector";
import { checkPortUsage } from "../checks/portCheck";
import { checkHostBinding } from "../checks/hostCheck";
import { checkStartCommand } from "../checks/startCommandCheck";
import { checkEnvVars } from "../checks/envVarsCheck";
import { checkDatabaseConfig } from "../checks/databaseCheck";
import { checkDjango } from "../frameworks/django";
import { checkFlask } from "../frameworks/flask";
import { checkFastAPI } from "../frameworks/fastapi";
import type { ScanResult, Issue, PassedCheck, Summary } from "../types";

export async function scanProject(projectPath: string): Promise<ScanResult> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Detect framework (optional - used for better suggestions)
  const framework = await detectFramework(projectPath);

  // Always run checks regardless of framework detection

  // PORT check - now scans all files
  const portResult = await checkPortUsage(projectPath, framework);
  issues.push(...portResult.issues);
  passed.push(...portResult.passed);

  // Host binding check - now scans all files
  const hostResult = await checkHostBinding(projectPath, framework);
  issues.push(...hostResult.issues);
  passed.push(...hostResult.passed);

  // Start command check - runs for all projects
  const startCommandIssues = checkStartCommand(projectPath, framework);
  if (startCommandIssues.length > 0) {
    issues.push(...startCommandIssues);
  } else {
    passed.push({
      id: "start-command-check",
      category: "start-command",
      message: "Start command looks good",
    });
  }

  // Environment variables check - runs for all projects
  const envVarsResult = await checkEnvVars(projectPath, framework);
  issues.push(...envVarsResult.issues);
  passed.push(...envVarsResult.passed);

  // Database configuration check - runs for all projects
  const databaseResult = await checkDatabaseConfig(projectPath, framework);
  issues.push(...databaseResult.issues);
  passed.push(...databaseResult.passed);

  // Framework-specific checks (when detected)
  if (framework.name === "django") {
    const djangoResult = await checkDjango(projectPath, framework);
    issues.push(...djangoResult.issues);
    passed.push(...djangoResult.passed);
  } else if (framework.name === "flask") {
    const flaskResult = await checkFlask(projectPath, framework);
    issues.push(...flaskResult.issues);
    passed.push(...flaskResult.passed);
  } else if (framework.name === "fastapi") {
    const fastapiResult = await checkFastAPI(projectPath, framework);
    issues.push(...fastapiResult.issues);
    passed.push(...fastapiResult.passed);
  }

  const summary = generateSummary(issues, passed);

  return {
    projectPath,
    framework,
    issues,
    warnings: issues.filter(i => i.severity === "warning"),
    passed,
    summary,
  };
}

function generateSummary(issues: Issue[], passed: PassedCheck[]): Summary {
  const errors = issues.filter(i => i.severity === "error").length;
  const warnings = issues.filter(i => i.severity === "warning").length;

  let deploymentLikelihood: "will-fail" | "might-fail" | "should-succeed";

  if (errors > 0) {
    deploymentLikelihood = "will-fail";
  } else if (warnings > 0) {
    deploymentLikelihood = "might-fail";
  } else {
    deploymentLikelihood = "should-succeed";
  }

  return {
    totalIssues: issues.length,
    errors,
    warnings,
    passed: passed.length,
    deploymentLikelihood,
  };
}
