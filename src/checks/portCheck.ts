import { readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type { Issue, Framework, PassedCheck } from "../types";

export async function checkPortUsage(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  try {
    // Find relevant source files based on project type
    const patterns = framework.name === "django" || framework.name === "flask" || framework.name === "fastapi"
      ? ["**/*.py"]
      : ["**/*.{js,ts,jsx,tsx}"];

    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ["node_modules/**", "dist/**", "build/**", ".next/**", "venv/**", "__pycache__/**", "*.test.*", "*.spec.*"],
      maxDepth: 5,
    });

    let foundPortIssues = false;

    // Scan each file for port issues
    for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
      try {
        const filePath = join(projectPath, file);
        const code = readFileSync(filePath, "utf-8");

        const fileIssues = await scanFileForPortIssues(code, file, framework);
        if (fileIssues.length > 0) {
          issues.push(...fileIssues);
          foundPortIssues = true;
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    // Framework-specific package.json checks for Next.js
    if (framework.name === "nextjs") {
      const packageJsonPath = join(projectPath, "package.json");
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const startScript = packageJson.scripts?.start || "";

        if (startScript.includes("next start") && !startScript.includes("$PORT") && !startScript.includes("${PORT")) {
          issues.push({
            id: "nextjs-port-flag",
            severity: "error",
            category: "port",
            message: "Next.js start script doesn't use Railway's PORT environment variable",
            file: "package.json",
            fix: {
              description: "Add PORT flag to Next.js start command",
              before: '"start": "next start"',
              after: '"start": "next start --port ${PORT-3000}"',
              steps: [
                'Update package.json scripts.start to: "next start --port ${PORT-3000}"',
              ],
            },
          });
          foundPortIssues = true;
        }
      } catch (error) {
        // Ignore if package.json not found or invalid
      }
    }

    if (!foundPortIssues) {
      passed.push({
        id: "port-check",
        category: "port",
        message: "PORT configuration looks good",
      });
    }

  } catch (error) {
    // Ignore glob errors
  }

  return { issues, passed };
}

async function scanFileForPortIssues(code: string, file: string, framework: Framework): Promise<Issue[]> {
  const issues: Issue[] = [];

  let hasPortEnvVar = false;
  let hasHardcodedPort = false;
  let listenCallLine: number | undefined;
  let hardcodedPortValue: number | undefined;

  // Check for process.env.PORT usage (JavaScript/TypeScript)
  if (code.includes("process.env.PORT") || code.includes("process.env['PORT']") || code.includes('process.env["PORT"]')) {
    hasPortEnvVar = true;
  }

  // Check for Python PORT usage
  if (code.includes("os.environ.get('PORT')") || code.includes('os.environ.get("PORT")') ||
      code.includes("os.getenv('PORT')") || code.includes('os.getenv("PORT")')) {
    hasPortEnvVar = true;
  }

  // Look for .listen() calls with hardcoded ports (JavaScript/TypeScript)
  const listenCallRegex = /\.listen\s*\(\s*(\d+)/g;
  let match;

  while ((match = listenCallRegex.exec(code)) !== null) {
    if (!match[1]) continue;
    const portNumber = parseInt(match[1]);
    if (portNumber >= 1000) {
      hasHardcodedPort = true;
      hardcodedPortValue = portNumber;
      // Calculate approximate line number
      const beforeMatch = code.substring(0, match.index);
      listenCallLine = beforeMatch.split("\n").length;
      break;
    }
  }

  // Also check for server creation patterns
  const portVarRegex = /(?:const|let|var)\s+(\w*[pP]ort\w*)\s*=\s*(\d+)/g;
  while ((match = portVarRegex.exec(code)) !== null) {
    if (!match[2]) continue;
    const portNumber = parseInt(match[2]);
    if (portNumber >= 1000 && !hasPortEnvVar) {
      hasHardcodedPort = true;
      hardcodedPortValue = portNumber;
      const beforeMatch = code.substring(0, match.index);
      listenCallLine = beforeMatch.split("\n").length;
      break;
    }
  }

  // Python-specific: Check for app.run(port=XXXX) or uvicorn.run(..., port=XXXX)
  const pythonPortRegex = /(?:app\.run|uvicorn\.run)\s*\([^)]*port\s*=\s*(\d+)/g;
  while ((match = pythonPortRegex.exec(code)) !== null) {
    if (!match[1]) continue;
    const portNumber = parseInt(match[1]);
    if (portNumber >= 1000 && !hasPortEnvVar) {
      hasHardcodedPort = true;
      hardcodedPortValue = portNumber;
      const beforeMatch = code.substring(0, match.index);
      listenCallLine = beforeMatch.split("\n").length;
      break;
    }
  }

  if (hasHardcodedPort && !hasPortEnvVar) {
    issues.push({
      id: "port-hardcoded",
      severity: "error",
      category: "port",
      message: `Hardcoded port ${hardcodedPortValue || "detected"}. Railway requires process.env.PORT`,
      file: file,
      line: listenCallLine,
      fix: {
        description: "Use process.env.PORT with a fallback for local development",
        before: `const port = ${hardcodedPortValue || 3000};`,
        after: `const port = process.env.PORT || ${hardcodedPortValue || 3000};`,
        steps: [
          `Update your server to use: const port = process.env.PORT || ${hardcodedPortValue || 3000}`,
          "Ensure your .listen() call uses this port variable",
        ],
      },
    });
  }

  return issues;
}
