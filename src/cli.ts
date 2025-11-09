#!/usr/bin/env bun

import { Command } from "commander";
import { resolve } from "path";
import { scanProject } from "./scanner";
import { formatResults, formatJSON } from "./output/formatter";

const program = new Command();

program
  .name("railway-doctor")
  .description("Diagnose Railway deployment issues before you deploy")
  .version("0.3.0");

program
  .command("scan")
  .description("Scan your project for Railway deployment issues")
  .argument("[path]", "Path to project directory", ".")
  .option("-v, --verbose", "Show all checks including passed ones")
  .option("-j, --json", "Output results as JSON")
  .action(async (path: string, options: { verbose?: boolean; json?: boolean }) => {
    const projectPath = resolve(path);

    try {
      const results = await scanProject(projectPath);

      if (options.json) {
        formatJSON(results);
      } else {
        formatResults(results, options.verbose || false);
      }

      // Exit with error code if there are errors
      const exitCode = results.summary.errors > 0 ? 1 : 0;
      process.exit(exitCode);
    } catch (error) {
      console.error("Error scanning project:", error);
      process.exit(1);
    }
  });

program.parse();
