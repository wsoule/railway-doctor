import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Issue, Framework, PassedCheck } from "../types";
import { findPythonMainFile, analyzePythonFile } from "../scanner/pythonAnalyzer";

export async function checkFastAPI(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Find FastAPI app file
  const mainFile = await findPythonMainFile(projectPath, ["main.py", "app.py", "application.py"]);

  if (!mainFile) {
    issues.push({
      id: "fastapi-no-app-file",
      severity: "warning",
      category: "start-command",
      message: "Could not find FastAPI app file (main.py, app.py, etc.)",
      fix: {
        description: "Ensure your FastAPI app file exists",
        steps: [
          "Common FastAPI entry points: main.py, app.py",
          "Make sure your FastAPI app is properly defined",
        ],
      },
    });
    return { issues, passed };
  }

  // Analyze FastAPI app file
  const analysis = await analyzePythonFile(mainFile);

  if (!analysis.hasFastAPIApp) {
    issues.push({
      id: "fastapi-no-app-init",
      severity: "warning",
      category: "start-command",
      message: "FastAPI app initialization not detected",
      file: mainFile,
      fix: {
        description: "Ensure FastAPI app is properly initialized",
        after: "app = FastAPI()",
        steps: [
          "Your FastAPI app should be initialized with FastAPI()",
        ],
      },
    });
  }

  // Check for uvicorn.run() (development mode)
  const content = readFileSync(mainFile, "utf-8");
  if (content.includes("uvicorn.run(")) {
    issues.push({
      id: "fastapi-dev-server",
      severity: "warning",
      category: "start-command",
      message: "uvicorn.run() detected - use command line uvicorn for production",
      file: mainFile,
      fix: {
        description: "Use command line uvicorn instead of uvicorn.run()",
        steps: [
          "Remove uvicorn.run() from your code",
          "Use Procfile with: web: uvicorn main:app --host 0.0.0.0 --port $PORT",
          "Or wrap in: if __name__ == '__main__': uvicorn.run()",
        ],
      },
    });
  }

  // Check requirements.txt for uvicorn
  const requirementsPath = join(projectPath, "requirements.txt");
  if (existsSync(requirementsPath)) {
    const requirements = readFileSync(requirementsPath, "utf-8").toLowerCase();
    if (!requirements.includes("uvicorn")) {
      issues.push({
        id: "fastapi-no-uvicorn",
        severity: "error",
        category: "start-command",
        message: "uvicorn not found in requirements.txt",
        file: requirementsPath,
        fix: {
          description: "Add uvicorn for ASGI server",
          after: "uvicorn[standard]",
          steps: [
            "Add 'uvicorn[standard]' to requirements.txt",
            "Uvicorn is the recommended ASGI server for FastAPI",
          ],
        },
      });
    } else {
      passed.push({
        id: "fastapi-has-uvicorn",
        category: "start-command",
        message: "Uvicorn found in requirements.txt",
      });
    }
  }

  // Check Procfile
  const procfilePath = join(projectPath, "Procfile");
  if (existsSync(procfilePath)) {
    const procfile = readFileSync(procfilePath, "utf-8");

    // Check if uvicorn is used
    if (!procfile.includes("uvicorn")) {
      issues.push({
        id: "fastapi-procfile-no-uvicorn",
        severity: "error",
        category: "start-command",
        message: "Procfile doesn't use uvicorn",
        file: procfilePath,
        fix: {
          description: "Use uvicorn in Procfile",
          after: "web: uvicorn main:app --host 0.0.0.0 --port $PORT",
          steps: [
            "Update Procfile to use uvicorn",
            "Format: web: uvicorn module:app --host 0.0.0.0 --port $PORT",
            "Replace 'module' with your Python file name (without .py)",
          ],
        },
      });
    }

    // Check for 0.0.0.0 host
    if (!procfile.includes("0.0.0.0")) {
      issues.push({
        id: "fastapi-procfile-no-host",
        severity: "error",
        category: "host",
        message: "Procfile doesn't bind to 0.0.0.0",
        file: procfilePath,
        fix: {
          description: "Add --host 0.0.0.0 to uvicorn command",
          steps: [
            "Update Procfile to bind to 0.0.0.0",
            "Example: web: uvicorn main:app --host 0.0.0.0 --port $PORT",
          ],
        },
      });
    }

    // Check for $PORT usage
    if (!procfile.includes("$PORT") && !procfile.includes("${PORT}")) {
      issues.push({
        id: "fastapi-procfile-no-port",
        severity: "error",
        category: "port",
        message: "Procfile doesn't use $PORT environment variable",
        file: procfilePath,
        fix: {
          description: "Use $PORT in uvicorn command",
          steps: [
            "Update Procfile to use $PORT",
            "Example: web: uvicorn main:app --host 0.0.0.0 --port $PORT",
          ],
        },
      });
    }

    if (procfile.includes("uvicorn") && procfile.includes("0.0.0.0") && (procfile.includes("$PORT") || procfile.includes("${PORT}"))) {
      passed.push({
        id: "fastapi-procfile-correct",
        category: "start-command",
        message: "Procfile configured correctly for Railway",
      });
    }

    // Suggest workers for production
    if (procfile.includes("uvicorn") && !procfile.includes("--workers")) {
      issues.push({
        id: "fastapi-no-workers",
        severity: "info",
        category: "start-command",
        message: "Consider adding workers for better performance",
        file: procfilePath,
        fix: {
          description: "Add workers to uvicorn for production",
          steps: [
            "Add --workers flag to uvicorn command",
            "Example: web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 4",
            "Workers enable concurrent request handling",
          ],
        },
      });
    }
  }

  return { issues, passed };
}
