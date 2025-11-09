import { readFileSync } from "fs";
import type { Issue, Framework } from "../types";

export function checkHostBinding(filePath: string, framework: Framework): Issue[] {
  const issues: Issue[] = [];

  try {
    const code = readFileSync(filePath, "utf-8");

    // Check if code explicitly binds to 0.0.0.0
    const hasCorrectBinding = code.includes('"0.0.0.0"') || code.includes("'0.0.0.0'") || code.includes("`0.0.0.0`");

    // Check for .listen() calls
    const hasListenCall = /\.listen\s*\(/.test(code);

    if (hasListenCall && !hasCorrectBinding) {
      // Check for localhost binding (a problem)
      const hasLocalhostBinding = code.includes('"localhost"') || code.includes("'localhost'") || code.includes('"127.0.0.1"') || code.includes("'127.0.0.1'");

      // Try to find the listen call
      const listenRegex = /\.listen\s*\([^)]+\)/g;
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
        file: filePath,
        line: listenLine,
        fix: generateHostBindingFix(framework, listenSnippet),
      });
    }

    // Next.js specific check
    if (framework.name === "nextjs") {
      const packageJsonPath = filePath.replace(/[^/]+$/, "package.json");
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const startScript = packageJson.scripts?.start || "";

        if (startScript.includes("next start") && !startScript.includes("--hostname 0.0.0.0") && !startScript.includes("-H 0.0.0.0")) {
          issues.push({
            id: "nextjs-host-flag",
            severity: "error",
            category: "host",
            message: "Next.js start script doesn't bind to 0.0.0.0",
            file: packageJsonPath,
            fix: {
              description: "Add --hostname flag to Next.js start command",
              before: '"start": "next start"',
              after: '"start": "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
              steps: [
                'Update package.json scripts.start to include: --hostname 0.0.0.0',
              ],
            },
          });
        }
      } catch (error) {
        // Ignore if package.json not found
      }
    }

  } catch (error) {
    // Silent fail - file might not exist
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
