import { readFileSync } from "fs";
import type { Issue, Framework } from "../types";

export function checkPortUsage(filePath: string, framework: Framework): Issue[] {
  const issues: Issue[] = [];

  try {
    const code = readFileSync(filePath, "utf-8");


    let hasPortEnvVar = false;
    let hasHardcodedPort = false;
    let listenCallLine: number | undefined;
    let hardcodedPortValue: number | undefined;

    // Check for process.env.PORT usage
    if (code.includes("process.env.PORT") || code.includes("PORT")) {
      hasPortEnvVar = true;
    }

    // Look for .listen() calls with hardcoded ports
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
      if (portNumber >= 1000 && !code.includes("process.env.PORT")) {
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
        file: filePath,
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

    // Framework-specific checks
    if (framework.name === "nextjs") {
      // Check for --port flag in scripts
      const packageJsonPath = filePath.replace(/[^/]+$/, "package.json");
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const startScript = packageJson.scripts?.start || "";

        if (startScript.includes("next start") && !startScript.includes("$PORT") && !startScript.includes("${PORT")) {
          issues.push({
            id: "nextjs-port-flag",
            severity: "error",
            category: "port",
            message: "Next.js start script doesn't use Railway's PORT environment variable",
            file: packageJsonPath,
            fix: {
              description: "Add PORT flag to Next.js start command",
              before: '"start": "next start"',
              after: '"start": "next start --port ${PORT-3000}"',
              steps: [
                'Update package.json scripts.start to: "next start --port ${PORT-3000}"',
              ],
            },
          });
        }
      } catch (error) {
        // Ignore if package.json not found or invalid
      }
    }

  } catch (error) {
    // If we can't parse the file, do a simple regex check
    try {
      const code = readFileSync(filePath, "utf-8");
      if (!code.includes("process.env.PORT") && /\.listen\s*\(\s*\d+/.test(code)) {
        issues.push({
          id: "port-hardcoded",
          severity: "error",
          category: "port",
          message: "Hardcoded port detected. Railway requires process.env.PORT",
          file: filePath,
          fix: {
            description: "Use process.env.PORT with a fallback",
            after: "const port = process.env.PORT || 3000;",
            steps: [
              "Replace hardcoded port with process.env.PORT || 3000",
              "Use this port variable in your .listen() call",
            ],
          },
        });
      }
    } catch (readError) {
      // Silent fail - file might not exist
    }
  }

  return issues;
}
