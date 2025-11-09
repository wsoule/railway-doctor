import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type { Framework } from "../types";

export async function detectFramework(projectPath: string): Promise<Framework> {
  const packageJsonPath = join(projectPath, "package.json");

  // Check for Node.js frameworks
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check for Next.js
    if (dependencies.next || existsSync(join(projectPath, "next.config.js")) || existsSync(join(projectPath, "next.config.mjs"))) {
      const mainFile = await findEntryPoint(projectPath, ["pages/_app.tsx", "pages/_app.js", "app/layout.tsx", "src/app/layout.tsx"]);
      return {
        name: "nextjs",
        version: dependencies.next,
        mainFile: mainFile || "next.config.js",
      };
    }

    // Check for NestJS
    if (dependencies["@nestjs/core"]) {
      const mainFile = await findEntryPoint(projectPath, ["src/main.ts", "main.ts"]);
      return {
        name: "nestjs",
        version: dependencies["@nestjs/core"],
        mainFile,
      };
    }

    // Check for Express
    if (dependencies.express) {
      const mainFile = await findEntryPoint(projectPath, ["server.js", "index.js", "app.js", "src/server.js", "src/index.js", "src/app.js", "server.ts", "src/server.ts"]);
      return {
        name: "express",
        version: dependencies.express,
        mainFile,
      };
    }
  }

  // Check for Python frameworks
  const requirementsTxtPath = join(projectPath, "requirements.txt");
  if (existsSync(requirementsTxtPath)) {
    const requirements = readFileSync(requirementsTxtPath, "utf-8").toLowerCase();

    if (requirements.includes("django")) {
      const managePyPath = join(projectPath, "manage.py");
      return {
        name: "django",
        mainFile: existsSync(managePyPath) ? "manage.py" : undefined,
      };
    }

    if (requirements.includes("flask")) {
      const mainFile = await findEntryPoint(projectPath, ["app.py", "main.py", "wsgi.py"]);
      return {
        name: "flask",
        mainFile,
      };
    }

    if (requirements.includes("fastapi")) {
      const mainFile = await findEntryPoint(projectPath, ["main.py", "app.py"]);
      return {
        name: "fastapi",
        mainFile,
      };
    }
  }

  return {
    name: "unknown",
  };
}

export async function findEntryPoint(projectPath: string, candidates: string[]): Promise<string | undefined> {
  // First check the candidates in order
  for (const candidate of candidates) {
    const filePath = join(projectPath, candidate);
    if (existsSync(filePath)) {
      return candidate;
    }
  }

  // Check package.json main field
  const packageJsonPath = join(projectPath, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.main && existsSync(join(projectPath, packageJson.main))) {
        return packageJson.main;
      }
    } catch (error) {
      // Ignore JSON parse errors
    }
  }

  // Use glob to find common entry point files
  try {
    const jsFiles = await glob("**/{server,index,app,main}.{js,ts}", {
      cwd: projectPath,
      ignore: ["node_modules/**", "dist/**", "build/**"],
      maxDepth: 3,
    });

    if (jsFiles.length > 0) {
      return jsFiles[0];
    }
  } catch (error) {
    // Ignore glob errors
  }

  return undefined;
}
