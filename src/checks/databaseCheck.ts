import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type { Issue, Framework, PassedCheck } from "../types";

export async function checkDatabaseConfig(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Detect database libraries
  const dbLibraries = detectDatabaseLibraries(projectPath, framework);

  if (dbLibraries.length === 0) {
    // No database detected, that's fine
    passed.push({
      id: "no-database",
      category: "database",
      message: "No database libraries detected",
    });
    return { issues, passed };
  }

  // Check for problematic connection strings
  const connectionIssues = await findDatabaseConnectionIssues(projectPath, framework, dbLibraries);
  issues.push(...connectionIssues);

  if (connectionIssues.length === 0) {
    passed.push({
      id: "database-config-ok",
      category: "database",
      message: "Database configuration looks good",
    });
  }

  return { issues, passed };
}

function detectDatabaseLibraries(projectPath: string, framework: Framework): string[] {
  const libraries: string[] = [];

  // Check Node.js projects
  if (["express", "nextjs", "nestjs"].includes(framework.name)) {
    const packageJsonPath = join(projectPath, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        const dbLibs = {
          pg: "PostgreSQL",
          postgres: "PostgreSQL",
          mysql: "MySQL",
          mysql2: "MySQL",
          mongodb: "MongoDB",
          mongoose: "MongoDB",
          "@prisma/client": "Prisma",
          prisma: "Prisma",
          typeorm: "TypeORM",
          sequelize: "Sequelize",
          knex: "Knex",
        };

        for (const [lib, name] of Object.entries(dbLibs)) {
          if (deps[lib]) {
            libraries.push(name);
          }
        }
      } catch (error) {
        // Ignore parse errors
      }
    }
  }

  // Check Python projects
  if (["django", "flask", "fastapi"].includes(framework.name)) {
    const requirementsPath = join(projectPath, "requirements.txt");
    if (existsSync(requirementsPath)) {
      const requirements = readFileSync(requirementsPath, "utf-8").toLowerCase();

      if (requirements.includes("psycopg") || requirements.includes("pg8000")) {
        libraries.push("PostgreSQL");
      }
      if (requirements.includes("pymongo")) {
        libraries.push("MongoDB");
      }
      if (requirements.includes("mysqlclient") || requirements.includes("pymysql")) {
        libraries.push("MySQL");
      }
      if (requirements.includes("sqlalchemy")) {
        libraries.push("SQLAlchemy");
      }
    }
  }

  return [...new Set(libraries)]; // Remove duplicates
}

async function findDatabaseConnectionIssues(projectPath: string, framework: Framework, dbLibraries: string[]): Promise<Issue[]> {
  const issues: Issue[] = [];

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

    let hasLocalhost = false;
    let hasSocketConnection = false;
    let hasDatabaseUrl = false;
    let localhostFile: string | undefined;
    let localhostLine: number | undefined;

    for (const file of files.slice(0, 30)) { // Limit for performance
      try {
        const filePath = join(projectPath, file);
        const content = readFileSync(filePath, "utf-8");
        const lines = content.split("\n");

        // Check for DATABASE_URL usage (good!)
        if (content.includes("DATABASE_URL") || content.includes("database_url")) {
          hasDatabaseUrl = true;
        }

        // Check for localhost connections (bad!)
        const localhostPatterns = [
          /['"]?localhost['"]?/i,
          /['"]?127\.0\.0\.1['"]?/,
          /host\s*[:=]\s*['"]localhost['"]/i,
          /host\s*[:=]\s*['"]127\.0\.0\.1['"]/i,
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (!line) continue;
          for (const pattern of localhostPatterns) {
            if (pattern.test(line) &&
                (line.includes("connect") || line.includes("host") || line.includes("DATABASES") || line.includes("createConnection"))) {
              hasLocalhost = true;
              localhostFile = file;
              localhostLine = i + 1;
              break;
            }
          }
          if (hasLocalhost) break;
        }

        // Check for socket connections (problematic on Railway)
        if (content.includes("/var/run/postgresql") || content.includes("/tmp/mysql.sock")) {
          hasSocketConnection = true;
        }

      } catch (error) {
        continue;
      }
    }

    // Generate issues based on findings
    if (hasLocalhost && !hasDatabaseUrl) {
      issues.push({
        id: "database-localhost",
        severity: "error",
        category: "database",
        message: "Database connection uses localhost, which won't work on Railway",
        file: localhostFile ? join(projectPath, localhostFile) : undefined,
        line: localhostLine,
        fix: {
          description: "Use DATABASE_URL environment variable for database connection",
          before: "host: 'localhost'",
          after: "connectionString: process.env.DATABASE_URL",
          steps: [
            "Replace hardcoded localhost with DATABASE_URL env var",
            "Railway provides DATABASE_URL automatically when you add a database",
            `Example for ${dbLibraries.join("/")}:`,
            "  const client = new Client({ connectionString: process.env.DATABASE_URL })",
          ],
        },
      });
    }

    if (hasSocketConnection) {
      issues.push({
        id: "database-socket",
        severity: "error",
        category: "database",
        message: "Database connection uses Unix socket, which won't work on Railway",
        fix: {
          description: "Use TCP connection with DATABASE_URL instead of Unix socket",
          steps: [
            "Remove socket file paths from database configuration",
            "Use DATABASE_URL environment variable",
            "Railway databases use TCP connections, not Unix sockets",
          ],
        },
      });
    }

    if (dbLibraries.length > 0 && !hasDatabaseUrl && !hasLocalhost) {
      issues.push({
        id: "database-url-recommended",
        severity: "info",
        category: "database",
        message: `Detected ${dbLibraries.join(", ")} - ensure you're using DATABASE_URL on Railway`,
        fix: {
          description: "Use DATABASE_URL environment variable",
          steps: [
            "Add a database service in your Railway project",
            "Railway will automatically inject DATABASE_URL",
            "Use this variable in your database connection code",
          ],
        },
      });
    }

  } catch (error) {
    // Ignore glob errors
  }

  return issues;
}
