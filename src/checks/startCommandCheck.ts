import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Issue, Framework } from "../types";

export function checkStartCommand(projectPath: string, framework: Framework): Issue[] {
  const issues: Issue[] = [];

  // Check Node.js projects
  if (["express", "nextjs", "nestjs"].includes(framework.name)) {
    const packageJsonPath = join(projectPath, "package.json");

    if (!existsSync(packageJsonPath)) {
      issues.push({
        id: "no-package-json",
        severity: "error",
        category: "start-command",
        message: "No package.json found",
        file: packageJsonPath,
        fix: {
          description: "Create a package.json file",
          steps: ["Run: npm init -y", "Add a start script to package.json"],
        },
      });
      return issues;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      const scripts = packageJson.scripts || {};
      const startScript = scripts.start;

      // Check if start script exists
      if (!startScript) {
        issues.push({
          id: "no-start-script",
          severity: "error",
          category: "start-command",
          message: 'No "start" script found in package.json',
          file: packageJsonPath,
          fix: generateStartScriptFix(framework),
        });
      } else {
        // Check for development tools in start script
        const devTools = ["nodemon", "ts-node-dev", "tsx --watch", "vite"];
        const usedDevTool = devTools.find(tool => startScript.includes(tool));

        if (usedDevTool) {
          issues.push({
            id: "dev-tools-in-production",
            severity: "error",
            category: "start-command",
            message: `Start script uses development tool: ${usedDevTool}`,
            file: packageJsonPath,
            fix: {
              description: "Use production-ready start command",
              before: `"start": "${startScript}"`,
              after: generateProductionStartScript(framework),
              steps: [
                "Remove development tools from start script",
                "Use node (not nodemon/ts-node-dev) for production",
                "If using TypeScript, build first then run with node",
              ],
            },
          });
        }

        // Framework-specific checks
        if (framework.name === "nextjs" && !startScript.includes("next start")) {
          issues.push({
            id: "nextjs-wrong-start",
            severity: "error",
            category: "start-command",
            message: "Next.js project should use 'next start' in production",
            file: packageJsonPath,
            fix: {
              description: "Use next start for production",
              before: `"start": "${startScript}"`,
              after: '"start": "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
              steps: [
                'Update start script to: "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
                'Ensure you have a build script: "build": "next build"',
              ],
            },
          });
        }

        if (framework.name === "nestjs" && startScript.includes("nest start") && !startScript.includes("nest start --watch")) {
          // NestJS with nest start is okay, but check if build exists
          if (!scripts.build || !scripts.build.includes("nest build")) {
            issues.push({
              id: "nestjs-no-build",
              severity: "warning",
              category: "start-command",
              message: "NestJS project should have a build script",
              file: packageJsonPath,
              fix: {
                description: "Add build script for NestJS",
                after: '"build": "nest build"',
                steps: ['Add to package.json scripts: "build": "nest build"'],
              },
            });
          }
        }
      }

      // Check for build script (important for Next.js and TypeScript projects)
      if (framework.name === "nextjs" && !scripts.build) {
        issues.push({
          id: "no-build-script",
          severity: "error",
          category: "start-command",
          message: "Next.js project missing build script",
          file: packageJsonPath,
          fix: {
            description: "Add build script for Next.js",
            after: '"build": "next build"',
            steps: ['Add to package.json scripts: "build": "next build"'],
          },
        });
      }

    } catch (error) {
      issues.push({
        id: "invalid-package-json",
        severity: "error",
        category: "start-command",
        message: "package.json is invalid or cannot be parsed",
        file: packageJsonPath,
        fix: {
          description: "Fix package.json syntax",
          steps: ["Validate JSON syntax in package.json", "Ensure all quotes and brackets are properly closed"],
        },
      });
    }
  }

  // Check Python projects
  if (["django", "flask", "fastapi"].includes(framework.name)) {
    const procfilePath = join(projectPath, "Procfile");
    const requirementsPath = join(projectPath, "requirements.txt");

    if (!existsSync(procfilePath)) {
      issues.push({
        id: "python-no-procfile",
        severity: "warning",
        category: "start-command",
        message: "Python project should have a Procfile for Railway",
        file: procfilePath,
        fix: generatePythonProcfileFix(framework),
      });
    } else {
      const procfile = readFileSync(procfilePath, "utf-8");

      if (framework.name === "django" && !procfile.includes("gunicorn")) {
        issues.push({
          id: "django-no-gunicorn",
          severity: "error",
          category: "start-command",
          message: "Django should use gunicorn in production",
          file: procfilePath,
          fix: {
            description: "Use gunicorn for Django production server",
            after: "web: gunicorn myproject.wsgi:application --bind 0.0.0.0:$PORT",
            steps: [
              "Add gunicorn to requirements.txt",
              "Create/update Procfile with gunicorn command",
            ],
          },
        });
      }
    }

    // Check for production server in requirements.txt
    if (existsSync(requirementsPath)) {
      const requirements = readFileSync(requirementsPath, "utf-8");

      if (framework.name === "django" && !requirements.includes("gunicorn")) {
        issues.push({
          id: "django-no-gunicorn-requirement",
          severity: "error",
          category: "start-command",
          message: "gunicorn not found in requirements.txt",
          file: requirementsPath,
          fix: {
            description: "Add gunicorn to requirements.txt",
            after: "gunicorn",
            steps: ["Add 'gunicorn' to requirements.txt"],
          },
        });
      }
    }
  }

  return issues;
}

function generateStartScriptFix(framework: Framework): any {
  const fixes: Record<string, any> = {
    express: {
      description: "Add start script for Express",
      after: `"scripts": {\n  "start": "node server.js"\n}`,
      steps: [
        'Add to package.json: "start": "node server.js"',
        "Replace server.js with your actual entry point file",
      ],
    },
    nextjs: {
      description: "Add start and build scripts for Next.js",
      after: '"scripts": {\n  "start": "next start --hostname 0.0.0.0 --port ${PORT-3000}",\n  "build": "next build"\n}',
      steps: [
        'Add start script: "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
        'Add build script: "next build"',
      ],
    },
    nestjs: {
      description: "Add start and build scripts for NestJS",
      after: `"scripts": {\n  "start": "node dist/main.js",\n  "build": "nest build"\n}`,
      steps: [
        'Add start script: "node dist/main.js"',
        'Add build script: "nest build"',
      ],
    },
  };

  return fixes[framework.name] || {
    description: "Add start script to package.json",
    after: '"scripts": {\n  "start": "node index.js"\n}',
    steps: ['Add a start script to package.json'],
  };
}

function generateProductionStartScript(framework: Framework): string {
  const scripts: Record<string, string> = {
    express: '"start": "node server.js"',
    nextjs: '"start": "next start --hostname 0.0.0.0 --port ${PORT-3000}"',
    nestjs: '"start": "node dist/main.js"',
  };

  return scripts[framework.name] || '"start": "node index.js"';
}

function generatePythonProcfileFix(framework: Framework): any {
  const fixes: Record<string, any> = {
    django: {
      description: "Create Procfile for Django",
      after: "web: gunicorn myproject.wsgi:application --bind 0.0.0.0:$PORT",
      steps: [
        "Create a file named 'Procfile' (no extension)",
        "Add: web: gunicorn myproject.wsgi:application --bind 0.0.0.0:$PORT",
        "Replace 'myproject' with your Django project name",
      ],
    },
    flask: {
      description: "Create Procfile for Flask",
      after: "web: gunicorn app:app --bind 0.0.0.0:$PORT",
      steps: [
        "Create a file named 'Procfile' (no extension)",
        "Add: web: gunicorn app:app --bind 0.0.0.0:$PORT",
      ],
    },
    fastapi: {
      description: "Create Procfile for FastAPI",
      after: "web: uvicorn main:app --host 0.0.0.0 --port $PORT",
      steps: [
        "Create a file named 'Procfile' (no extension)",
        "Add: web: uvicorn main:app --host 0.0.0.0 --port $PORT",
      ],
    },
  };

  return fixes[framework.name] || {
    description: "Create Procfile",
    steps: ["Create a Procfile with your start command"],
  };
}
