import { readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type { Issue, Framework, PassedCheck } from "../types";

export async function checkHostBinding(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
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

    let foundHostIssues = false;

    // Scan each file for host binding issues
    for (const file of files.slice(0, 50)) { // Limit to first 50 files for performance
      try {
        const filePath = join(projectPath, file);
        const code = readFileSync(filePath, "utf-8");

        const fileIssues = await scanFileForHostIssues(code, file, framework);
        if (fileIssues.length > 0) {
          issues.push(...fileIssues);
          foundHostIssues = true;
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

        if (startScript.includes("next start") && !startScript.includes("--hostname 0.0.0.0") && !startScript.includes("-H 0.0.0.0")) {
          issues.push({
            id: "nextjs-host-flag",
            severity: "error",
            category: "host",
            message: "Next.js start script doesn't bind to 0.0.0.0",
            file: "package.json",
            fix: {
              description: "Add --hostname flag to Next.js start command",
              before: '"start": "next start"',
              after: '"start": "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
              steps: [
                'Update package.json scripts.start to include: --hostname 0.0.0.0',
              ],
            },
          });
          foundHostIssues = true;
        }
      } catch (error) {
        // Ignore if package.json not found
      }
    }

    if (!foundHostIssues) {
      passed.push({
        id: "host-check",
        category: "host",
        message: "Host binding configuration looks good",
      });
    }

  } catch (error) {
    // Ignore glob errors
  }

  return { issues, passed };
}

async function scanFileForHostIssues(code: string, file: string, framework: Framework): Promise<Issue[]> {
  const issues: Issue[] = [];

  // Check if code explicitly binds to 0.0.0.0
  const hasCorrectBinding = code.includes('"0.0.0.0"') || code.includes("'0.0.0.0'") || code.includes("`0.0.0.0`");

  // Check for .listen() calls
  const hasListenCall = /\.listen\s*\(/.test(code);

  // Check for Python server patterns (app.run, uvicorn.run, etc.)
  const hasPythonServerCall = /(?:app\.run|uvicorn\.run|waitress\.serve)\s*\(/.test(code);

  if ((hasListenCall || hasPythonServerCall) && !hasCorrectBinding) {
    // Check for localhost binding (a problem)
    const hasLocalhostBinding = code.includes('"localhost"') || code.includes("'localhost'") ||
                                 code.includes('"127.0.0.1"') || code.includes("'127.0.0.1'");

    // Try to find the listen/run call
    const listenRegex = /\.(?:listen|run)\s*\([^)]+\)/g;
    let match = listenRegex.exec(code);

    let listenLine: number | undefined;
    let listenSnippet: string | undefined;

    if (match) {
      const beforeMatch = code.substring(0, match.index);
      listenLine = beforeMatch.split("\n").length;
      listenSnippet = match[0];
    }

    const severity = hasLocalhostBinding ? "error" : "warning";
    const message = hasLocalhostBinding
      ? "App binds to localhost/127.0.0.1, which won't work on Railway"
      : "App may not be binding to 0.0.0.0, which is required for Railway";

    issues.push({
      id: "host-binding",
      severity,
      category: "host",
      message,
      file: file,
      line: listenLine,
      fix: generateHostBindingFix(framework, listenSnippet),
    });
  }

  return issues;
}

function generateHostBindingFix(framework: Framework, listenSnippet?: string): any {
  const fixes: Record<string, any> = {
    express: {
      description: "Bind to 0.0.0.0 to accept external connections",
      before: 'app.listen(port)',
      after: 'app.listen(port, "0.0.0.0")',
      steps: [
        'Update your .listen() call to: app.listen(port, "0.0.0.0")',
        'This allows Railway to route traffic to your application',
      ],
    },
    nestjs: {
      description: "Bind to 0.0.0.0 in your NestJS bootstrap function",
      before: 'await app.listen(port)',
      after: 'await app.listen(port, "0.0.0.0")',
      steps: [
        'In src/main.ts, update: await app.listen(port, "0.0.0.0")',
        'This allows Railway to route traffic to your application',
      ],
    },
    nextjs: {
      description: "Add --hostname flag to Next.js start command",
      before: '"start": "next start"',
      after: '"start": "next start --hostname 0.0.0.0"',
      steps: [
        'Update package.json start script to include: --hostname 0.0.0.0',
      ],
    },
    django: {
      description: "Configure Django to bind to 0.0.0.0",
      after: 'gunicorn myproject.wsgi:application --bind 0.0.0.0:$PORT',
      steps: [
        'Ensure your start command binds to 0.0.0.0:$PORT',
        'Example: gunicorn myproject.wsgi:application --bind 0.0.0.0:$PORT',
      ],
    },
    flask: {
      description: "Bind to 0.0.0.0 in Flask app",
      before: 'app.run()',
      after: 'app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))',
      steps: [
        'Update app.run() to bind to 0.0.0.0',
        'Use gunicorn in production instead of Flask development server',
      ],
    },
    fastapi: {
      description: "Bind to 0.0.0.0 in uvicorn",
      before: 'uvicorn.run(app)',
      after: 'uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8000)))',
      steps: [
        'Update uvicorn.run() to bind to 0.0.0.0',
        'Use Procfile with proper uvicorn command in production',
      ],
    },
  };

  return fixes[framework.name] || {
    description: "Bind to 0.0.0.0 to accept external connections",
    before: listenSnippet || '.listen(port)',
    after: '.listen(port, "0.0.0.0")',
    steps: [
      'Update your server to listen on 0.0.0.0 instead of localhost',
      'This allows Railway to route traffic to your application',
    ],
  };
}
