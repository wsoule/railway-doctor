import chalk from "chalk";
import type { ScanResult, Issue } from "../types";

export function formatResults(results: ScanResult, verbose: boolean = false): void {
  console.log("\n" + chalk.cyan.bold("Railway Deployment Doctor"));
  console.log(chalk.cyan("━".repeat(50)) + "\n");

  // Framework detection
  if (results.framework) {
    console.log(chalk.blue("Framework detected:"), chalk.bold(results.framework.name));
    if (results.framework.mainFile) {
      console.log(chalk.blue("Entry point:"), results.framework.mainFile);
    }
    console.log();
  }

  // Display errors
  const errors = results.issues.filter(i => i.severity === "error");
  const warnings = results.issues.filter(i => i.severity === "warning");

  if (errors.length > 0) {
    console.log(chalk.red.bold(`[ERROR] Found ${errors.length} error${errors.length > 1 ? "s" : ""}`));
    console.log();
    errors.forEach(issue => displayIssue(issue, "error"));
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`[WARNING] Found ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`));
    console.log();
    warnings.forEach(issue => displayIssue(issue, "warning"));
  }

  // Display passed checks if verbose
  if (verbose && results.passed.length > 0) {
    console.log(chalk.green.bold(`[PASS] Passed ${results.passed.length} check${results.passed.length > 1 ? "s" : ""}`));
    console.log();
    results.passed.forEach(check => {
      console.log(chalk.green("  [PASS]"), check.message);
    });
    console.log();
  }

  // Display summary
  displaySummary(results);
}

function displayIssue(issue: Issue, type: "error" | "warning"): void {
  const icon = type === "error" ? "[X]" : "[!]";
  const color = type === "error" ? chalk.red : chalk.yellow;

  console.log(color.bold(icon + " " + issue.message));

  if (issue.file) {
    const location = issue.line ? `${issue.file}:${issue.line}` : issue.file;
    console.log(color("   File:"), chalk.gray(location));
  }

  console.log();
  console.log(chalk.cyan("   Fix:"), issue.fix.description);

  if (issue.fix.before && issue.fix.after) {
    console.log();
    console.log(chalk.red("   - " + issue.fix.before));
    console.log(chalk.green("   + " + issue.fix.after));
  } else if (issue.fix.after) {
    console.log();
    console.log(chalk.green("   + " + issue.fix.after));
  }

  if (issue.fix.steps && issue.fix.steps.length > 0) {
    console.log();
    issue.fix.steps.forEach((step, index) => {
      console.log(chalk.gray(`   ${index + 1}. ${step}`));
    });
  }

  console.log();
}

function displaySummary(results: ScanResult): void {
  console.log(chalk.cyan("━".repeat(50)));
  console.log(chalk.cyan.bold("Summary"));
  console.log(chalk.cyan("━".repeat(50)));

  const { summary } = results;

  console.log(chalk.blue("  Total checks:"), summary.totalIssues + summary.passed);
  console.log(chalk.green("  Passed:"), summary.passed);
  console.log(chalk.yellow("  Warnings:"), summary.warnings);
  console.log(chalk.red("  Errors:"), summary.errors);

  console.log();

  // Deployment likelihood
  const likelihood = summary.deploymentLikelihood;
  if (likelihood === "will-fail") {
    console.log(chalk.red.bold("Deployment Likelihood: WILL FAIL"));
    console.log(chalk.red(`   Fix the ${summary.errors} error${summary.errors > 1 ? "s" : ""} above before deploying.`));
  } else if (likelihood === "might-fail") {
    console.log(chalk.yellow.bold("Deployment Likelihood: MIGHT FAIL"));
    console.log(chalk.yellow(`   Address the ${summary.warnings} warning${summary.warnings > 1 ? "s" : ""} to improve deployment success.`));
  } else {
    console.log(chalk.green.bold("Deployment Likelihood: SHOULD SUCCEED"));
    console.log(chalk.green("   Your project looks ready for Railway deployment!"));
  }

  console.log();
}

export function formatJSON(results: ScanResult): void {
  console.log(JSON.stringify(results, null, 2));
}
