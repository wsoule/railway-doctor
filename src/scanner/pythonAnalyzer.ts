import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { glob } from "glob";

export interface PythonFileAnalysis {
  hasFlaskApp: boolean;
  hasFastAPIApp: boolean;
  djangoSettings: DjangoSettings | null;
  imports: string[];
}

export interface DjangoSettings {
  allowedHosts: string[];
  debug: boolean | null;
  hasWhitenoise: boolean;
  hasDatabaseUrl: boolean;
  hasStaticRoot: boolean;
  csrfTrustedOrigins: string[];
}

/**
 * Analyzes Python files for framework-specific patterns
 */
export async function analyzePythonFile(filePath: string): Promise<PythonFileAnalysis> {
  const result: PythonFileAnalysis = {
    hasFlaskApp: false,
    hasFastAPIApp: false,
    djangoSettings: null,
    imports: [],
  };

  if (!existsSync(filePath)) {
    return result;
  }

  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Extract imports
  for (const line of lines) {
    const importMatch = line.match(/^(?:from|import)\s+([a-zA-Z0-9_.]+)/);
    if (importMatch) {
      result.imports.push(importMatch[1]);
    }
  }

  // Check for Flask app initialization
  if (content.match(/app\s*=\s*Flask\s*\(/)) {
    result.hasFlaskApp = true;
  }

  // Check for FastAPI app initialization
  if (content.match(/app\s*=\s*FastAPI\s*\(/)) {
    result.hasFastAPIApp = true;
  }

  // Check for Django settings patterns
  if (filePath.includes("settings.py")) {
    result.djangoSettings = parseDjangoSettings(content);
  }

  return result;
}

function parseDjangoSettings(content: string): DjangoSettings {
  const settings: DjangoSettings = {
    allowedHosts: [],
    debug: null,
    hasWhitenoise: false,
    hasDatabaseUrl: false,
    hasStaticRoot: false,
    csrfTrustedOrigins: [],
  };

  // Parse ALLOWED_HOSTS
  const allowedHostsMatch = content.match(/ALLOWED_HOSTS\s*=\s*\[([^\]]*)\]/s);
  if (allowedHostsMatch) {
    const hostsStr = allowedHostsMatch[1];
    const hosts = hostsStr.match(/['"]([^'"]+)['"]/g);
    if (hosts) {
      settings.allowedHosts = hosts.map(h => h.replace(/['"]/g, ""));
    }
  }

  // Parse DEBUG
  const debugMatch = content.match(/DEBUG\s*=\s*(True|False)/);
  if (debugMatch) {
    settings.debug = debugMatch[1] === "True";
  }

  // Check for whitenoise in MIDDLEWARE
  if (content.includes("whitenoise")) {
    settings.hasWhitenoise = true;
  }

  // Check for DATABASE_URL usage
  if (content.includes("DATABASE_URL") || content.includes("dj_database_url") || content.includes("dj-database-url")) {
    settings.hasDatabaseUrl = true;
  }

  // Check for STATIC_ROOT
  if (content.match(/STATIC_ROOT\s*=/)) {
    settings.hasStaticRoot = true;
  }

  // Parse CSRF_TRUSTED_ORIGINS
  const csrfOriginsMatch = content.match(/CSRF_TRUSTED_ORIGINS\s*=\s*\[([^\]]*)\]/s);
  if (csrfOriginsMatch) {
    const originsStr = csrfOriginsMatch[1];
    const origins = originsStr.match(/['"]([^'"]+)['"]/g);
    if (origins) {
      settings.csrfTrustedOrigins = origins.map(o => o.replace(/['"]/g, ""));
    }
  }

  return settings;
}

/**
 * Finds Django settings.py file in project
 */
export async function findDjangoSettings(projectPath: string): Promise<string | null> {
  try {
    const files = await glob("**/settings.py", {
      cwd: projectPath,
      ignore: ["venv/**", "env/**", ".venv/**", "node_modules/**"],
      maxDepth: 3,
    });

    if (files.length > 0) {
      return join(projectPath, files[0]);
    }
  } catch (error) {
    // Ignore glob errors
  }

  return null;
}

/**
 * Finds Flask/FastAPI main file
 */
export async function findPythonMainFile(projectPath: string, candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    const filePath = join(projectPath, candidate);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  // Search for common patterns
  try {
    const files = await glob("**/{app,main,wsgi,application}.py", {
      cwd: projectPath,
      ignore: ["venv/**", "env/**", ".venv/**", "node_modules/**"],
      maxDepth: 3,
    });

    if (files.length > 0) {
      return join(projectPath, files[0]);
    }
  } catch (error) {
    // Ignore glob errors
  }

  return null;
}
