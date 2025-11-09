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

  // Detect framework
  const framework = await detectFramework(projectPath);

  // Run checks only if we have a main file or it's a known framework
  if (framework.mainFile || framework.name !== "unknown") {
    // PORT check
    if (framework.mainFile) {
      const portIssues = checkPortUsage(join(projectPath, framework.mainFile), framework);
      if (portIssues.length > 0) {
        issues.push(...portIssues);
      } else {
        passed.push({
          id: "port-check",
          category: "port",
          message: "PORT configuration looks good",
        });
      }

      // Host binding check
      const hostIssues = checkHostBinding(join(projectPath, framework.mainFile), framework);
      if (hostIssues.length > 0) {
        issues.push(...hostIssues);
      } else {
        passed.push({
          id: "host-check",
          category: "host",
          message: "Host binding configuration looks good",
        });
      }
    }

    // Start command check
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

    // Environment variables check
    const envVarsResult = await checkEnvVars(projectPath, framework);
    issues.push(...envVarsResult.issues);
    passed.push(...envVarsResult.passed);

    // Database configuration check
    const databaseResult = await checkDatabaseConfig(projectPath, framework);
    issues.push(...databaseResult.issues);
    passed.push(...databaseResult.passed);

    // Framework-specific checks
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
  } else {
    issues.push({
      id: "unknown-framework",
      severity: "warning",
      category: "start-command",
      message: "Could not detect framework or entry point",
      fix: {
        description: "Ensure your project has a package.json or requirements.txt",
        steps: [
          "For Node.js: Run 'npm init' to create package.json",
          "For Python: Create requirements.txt with your dependencies",
        ],
      },
    });
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
