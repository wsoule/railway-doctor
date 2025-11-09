import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Issue, Framework, PassedCheck } from "../types";
import { findPythonMainFile, analyzePythonFile } from "../scanner/pythonAnalyzer";

export async function checkFlask(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Find Flask app file
  const mainFile = await findPythonMainFile(projectPath, ["app.py", "main.py", "wsgi.py", "application.py"]);

  if (!mainFile) {
    issues.push({
      id: "flask-no-app-file",
      severity: "warning",
      category: "start-command",
      message: "Could not find Flask app file (app.py, main.py, etc.)",
      fix: {
        description: "Ensure your Flask app file exists",
        steps: [
          "Common Flask entry points: app.py, main.py, wsgi.py",
          "Make sure your Flask app is properly defined",
        ],
      },
    });
    return { issues, passed };
  }

  // Analyze Flask app file
  const analysis = await analyzePythonFile(mainFile);

  if (!analysis.hasFlaskApp) {
    issues.push({
      id: "flask-no-app-init",
      severity: "warning",
      category: "start-command",
      message: "Flask app initialization not detected",
      file: mainFile,
      fix: {
        description: "Ensure Flask app is properly initialized",
        after: "app = Flask(__name__)",
        steps: [
          "Your Flask app should be initialized with Flask(__name__)",
        ],
      },
    });
  }

  // Check for development server usage in app.run()
  const content = readFileSync(mainFile, "utf-8");
  if (content.includes("app.run(")) {
    const hasDebugTrue = content.match(/app\.run\([^)]*debug\s*=\s*True/);
    if (hasDebugTrue) {
      issues.push({
        id: "flask-debug-mode",
        severity: "error",
        category: "start-command",
        message: "Flask debug mode detected - should not be used in production",
        file: mainFile,
        fix: {
          description: "Remove debug mode and use gunicorn for production",
          before: "app.run(debug=True)",
          after: "app.run()  # Or remove entirely and use gunicorn",
          steps: [
            "Remove debug=True from app.run()",
            "Use gunicorn instead of Flask development server",
            "Example Procfile: web: gunicorn app:app --bind 0.0.0.0:$PORT",
          ],
        },
      });
    }

    // Check if app.run() is used at all (suggests development server)
    issues.push({
      id: "flask-dev-server",
      severity: "warning",
      category: "start-command",
      message: "Flask development server (app.run()) detected",
      file: mainFile,
      fix: {
        description: "Use gunicorn for production instead of app.run()",
        steps: [
          "Add gunicorn to requirements.txt",
          "Create Procfile: web: gunicorn app:app --bind 0.0.0.0:$PORT",
          "Remove or wrap app.run() in if __name__ == '__main__'",
        ],
      },
    });
  }

  // Check requirements.txt for gunicorn
  const requirementsPath = join(projectPath, "requirements.txt");
  if (existsSync(requirementsPath)) {
    const requirements = readFileSync(requirementsPath, "utf-8").toLowerCase();
    if (!requirements.includes("gunicorn")) {
      issues.push({
        id: "flask-no-gunicorn",
        severity: "error",
        category: "start-command",
        message: "gunicorn not found in requirements.txt",
        file: requirementsPath,
        fix: {
          description: "Add gunicorn for production server",
          after: "gunicorn",
          steps: [
            "Add 'gunicorn' to requirements.txt",
            "Gunicorn is the recommended production server for Flask",
          ],
        },
      });
    } else {
      passed.push({
        id: "flask-has-gunicorn",
        category: "start-command",
        message: "Gunicorn found in requirements.txt",
      });
    }
  }

  // Check Procfile
  const procfilePath = join(projectPath, "Procfile");
  if (existsSync(procfilePath)) {
    const procfile = readFileSync(procfilePath, "utf-8");

    // Check if gunicorn is used
    if (!procfile.includes("gunicorn")) {
      issues.push({
        id: "flask-procfile-no-gunicorn",
        severity: "error",
        category: "start-command",
        message: "Procfile doesn't use gunicorn",
        file: procfilePath,
        fix: {
          description: "Use gunicorn in Procfile",
          after: "web: gunicorn app:app --bind 0.0.0.0:$PORT",
          steps: [
            "Update Procfile to use gunicorn",
            "Format: web: gunicorn module:app --bind 0.0.0.0:$PORT",
            "Replace 'module' with your Python file name (without .py)",
          ],
        },
      });
    }

    // Check for 0.0.0.0 binding
    if (!procfile.includes("0.0.0.0")) {
      issues.push({
        id: "flask-procfile-no-host",
        severity: "error",
        category: "host",
        message: "Procfile doesn't bind to 0.0.0.0",
        file: procfilePath,
        fix: {
          description: "Add --bind 0.0.0.0:$PORT to gunicorn command",
          steps: [
            "Update Procfile to bind to 0.0.0.0",
            "Example: web: gunicorn app:app --bind 0.0.0.0:$PORT",
          ],
        },
      });
    }

    // Check for $PORT usage
    if (!procfile.includes("$PORT") && !procfile.includes("${PORT}")) {
      issues.push({
        id: "flask-procfile-no-port",
        severity: "error",
        category: "port",
        message: "Procfile doesn't use $PORT environment variable",
        file: procfilePath,
        fix: {
          description: "Use $PORT in gunicorn bind address",
          steps: [
            "Update Procfile to use $PORT",
            "Example: web: gunicorn app:app --bind 0.0.0.0:$PORT",
          ],
        },
      });
    }

    if (procfile.includes("gunicorn") && procfile.includes("0.0.0.0") && (procfile.includes("$PORT") || procfile.includes("${PORT}"))) {
      passed.push({
        id: "flask-procfile-correct",
        category: "start-command",
        message: "Procfile configured correctly for Railway",
      });
    }
  }

  return { issues, passed };
}
