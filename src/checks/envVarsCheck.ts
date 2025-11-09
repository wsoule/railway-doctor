import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type { Issue, Framework, PassedCheck } from "../types";

export async function checkEnvVars(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Check for .env file
  const dotEnvPath = join(projectPath, ".env");
  const gitignorePath = join(projectPath, ".gitignore");
  const hasDotEnv = existsSync(dotEnvPath);
  const hasGitignore = existsSync(gitignorePath);

  // Find all env var references in code
  const envVars = await findEnvVarReferences(projectPath, framework);

  // Check if .env is committed (bad practice)
  if (hasDotEnv && hasGitignore) {
    const gitignoreContent = readFileSync(gitignorePath, "utf-8");
    const isDotEnvIgnored = gitignoreContent.includes(".env");

    if (!isDotEnvIgnored) {
      issues.push({
        id: "env-file-not-ignored",
        severity: "warning",
        category: "env-vars",
        message: ".env file exists but is not in .gitignore (security risk)",
        file: gitignorePath,
        fix: {
          description: "Add .env to .gitignore to prevent committing secrets",
          after: ".env",
          steps: [
            "Add '.env' to your .gitignore file",
            "Never commit .env files to version control",
            "Use Railway environment variables instead",
          ],
        },
      });
    } else {
      passed.push({
        id: "env-file-ignored",
        category: "env-vars",
        message: ".env file is properly ignored in .gitignore",
      });
    }
  }

  if (!hasDotEnv && !hasGitignore) {
    passed.push({
      id: "no-env-file",
      category: "env-vars",
      message: "No .env file found (good - use Railway environment variables)",
    });
  }

  // Provide helpful info about env vars that should be set in Railway
  if (envVars.size > 0) {
    const commonEnvVars = ["PORT", "NODE_ENV", "DATABASE_URL"];
    // Filter out common Railway-provided vars and npm internal vars
    const otherVars = Array.from(envVars).filter(v => !commonEnvVars.includes(v) && !v.includes("npm_"));

    if (otherVars.length > 0) {
      issues.push({
        id: "env-vars-needed",
        severity: "info",
        category: "env-vars",
        message: `Found ${envVars.size} environment variable${envVars.size > 1 ? "s" : ""} in your code`,
        fix: {
          description: "Set these environment variables in Railway",
          steps: [
            `Environment variables detected: ${otherVars.slice(0, 10).join(", ")}${otherVars.length > 10 ? "..." : ""}`,
            "Go to your Railway project settings",
            "Add each variable in the Variables section",
            "Railway will inject these at runtime",
          ],
        },
      });
    }
  }

  return { issues, passed };
}

async function findEnvVarReferences(projectPath: string, framework: Framework): Promise<Set<string>> {
  const envVars = new Set<string>();

  try {
    // Find relevant source files
    const patterns = framework.name === "django" || framework.name === "flask" || framework.name === "fastapi"
      ? ["**/*.py"]
      : ["**/*.{js,ts,jsx,tsx}"];

    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ["node_modules/**", "dist/**", "build/**", ".next/**", "venv/**", "__pycache__/**"],
      maxDepth: 5,
    });

    // Scan each file for env var usage
    for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
      try {
        const filePath = join(projectPath, file);
        const content = readFileSync(filePath, "utf-8");

        // JavaScript/TypeScript pattern: process.env.VARIABLE_NAME
        const jsEnvRegex = /process\.env\.(\w+)/g;
        let match;
        while ((match = jsEnvRegex.exec(content)) !== null) {
          match[1] && envVars.add(match[1]);
        }

        // Python pattern: os.environ.get('VARIABLE_NAME') or os.getenv('VARIABLE_NAME')
        const pyEnvRegex = /os\.(?:environ\.get|getenv)\(['"](\w+)['"]\)/g;
        while ((match = pyEnvRegex.exec(content)) !== null) {
          match[1] && envVars.add(match[1]);
        }

        // Python pattern: os.environ['VARIABLE_NAME']
        const pyEnvBracketRegex = /os\.environ\[['"](\w+)['"]\]/g;
        while ((match = pyEnvBracketRegex.exec(content)) !== null) {
          match[1] && envVars.add(match[1]);
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  } catch (error) {
    // Ignore glob errors
  }

  return envVars;
}
