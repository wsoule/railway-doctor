import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Issue, Framework, PassedCheck } from "../types";
import { findDjangoSettings, analyzePythonFile } from "../scanner/pythonAnalyzer";

export async function checkDjango(projectPath: string, framework: Framework): Promise<{ issues: Issue[]; passed: PassedCheck[] }> {
  const issues: Issue[] = [];
  const passed: PassedCheck[] = [];

  // Find settings.py
  const settingsPath = await findDjangoSettings(projectPath);

  if (!settingsPath) {
    issues.push({
      id: "django-no-settings",
      severity: "error",
      category: "start-command",
      message: "Django settings.py file not found",
      fix: {
        description: "Ensure your Django project has a settings.py file",
        steps: [
          "Verify your Django project structure is correct",
          "settings.py should be in your Django app directory",
        ],
      },
    });
    return { issues, passed };
  }

  // Analyze Django settings
  const analysis = await analyzePythonFile(settingsPath);
  if (!analysis.djangoSettings) {
    return { issues, passed };
  }

  const settings = analysis.djangoSettings;

  // Check ALLOWED_HOSTS
  if (settings.allowedHosts.length === 0 || (settings.allowedHosts.length === 1 && settings.allowedHosts[0] === "")) {
    issues.push({
      id: "django-empty-allowed-hosts",
      severity: "error",
      category: "host",
      message: "ALLOWED_HOSTS is empty - Django will reject all requests on Railway",
      file: settingsPath,
      fix: {
        description: "Add Railway domains to ALLOWED_HOSTS",
        before: "ALLOWED_HOSTS = []",
        after: "ALLOWED_HOSTS = ['*']  # Or specify Railway domain",
        steps: [
          "Update ALLOWED_HOSTS in settings.py",
          "Use ['*'] for wildcard or add your Railway domain",
          "Example: ALLOWED_HOSTS = ['.railway.app', 'yourdomain.com']",
        ],
      },
    });
  } else if (!settings.allowedHosts.includes("*") && !settings.allowedHosts.some(h => h.includes("railway.app"))) {
    issues.push({
      id: "django-no-railway-hosts",
      severity: "warning",
      category: "host",
      message: "ALLOWED_HOSTS doesn't include Railway domains",
      file: settingsPath,
      fix: {
        description: "Add Railway domains to ALLOWED_HOSTS",
        steps: [
          "Add '.railway.app' to ALLOWED_HOSTS",
          "Or use ['*'] to allow all hosts",
          "Current hosts: " + settings.allowedHosts.join(", "),
        ],
      },
    });
  } else {
    passed.push({
      id: "django-allowed-hosts",
      category: "host",
      message: "ALLOWED_HOSTS configured correctly",
    });
  }

  // Check DEBUG setting
  if (settings.debug === true) {
    issues.push({
      id: "django-debug-true",
      severity: "warning",
      category: "start-command",
      message: "DEBUG is set to True - should be False in production",
      file: settingsPath,
      fix: {
        description: "Set DEBUG based on environment variable",
        before: "DEBUG = True",
        after: "DEBUG = os.environ.get('DEBUG', 'False') == 'True'",
        steps: [
          "Use environment variable to control DEBUG",
          "Set DEBUG=False in Railway environment variables",
        ],
      },
    });
  } else if (settings.debug === false) {
    passed.push({
      id: "django-debug-false",
      category: "start-command",
      message: "DEBUG is correctly set to False",
    });
  }

  // Check for whitenoise (static files)
  if (!settings.hasWhitenoise) {
    issues.push({
      id: "django-no-whitenoise",
      severity: "error",
      category: "static-files",
      message: "Whitenoise not detected - static files won't be served on Railway",
      file: settingsPath,
      fix: {
        description: "Install and configure whitenoise for static files",
        steps: [
          "Add 'whitenoise' to requirements.txt",
          "Add 'whitenoise.middleware.WhiteNoiseMiddleware' to MIDDLEWARE in settings.py",
          "Add after SecurityMiddleware, before other middleware",
          "Set STATIC_ROOT = BASE_DIR / 'staticfiles'",
        ],
      },
    });
  } else {
    passed.push({
      id: "django-whitenoise",
      category: "static-files",
      message: "Whitenoise configured for static files",
    });
  }

  // Check for STATIC_ROOT
  if (!settings.hasStaticRoot) {
    issues.push({
      id: "django-no-static-root",
      severity: "warning",
      category: "static-files",
      message: "STATIC_ROOT not set",
      file: settingsPath,
      fix: {
        description: "Set STATIC_ROOT for collectstatic",
        after: "STATIC_ROOT = BASE_DIR / 'staticfiles'",
        steps: [
          "Add STATIC_ROOT to settings.py",
          "Run 'python manage.py collectstatic' before deployment",
        ],
      },
    });
  }

  // Check for DATABASE_URL usage
  if (!settings.hasDatabaseUrl) {
    issues.push({
      id: "django-no-database-url",
      severity: "warning",
      category: "database",
      message: "DATABASE_URL not detected - database configuration may be hardcoded",
      file: settingsPath,
      fix: {
        description: "Use dj-database-url for Railway database",
        steps: [
          "Add 'dj-database-url' to requirements.txt",
          "Import: import dj_database_url",
          "Use: DATABASES['default'] = dj_database_url.config(conn_max_age=600)",
          "Railway automatically provides DATABASE_URL",
        ],
      },
    });
  } else {
    passed.push({
      id: "django-database-url",
      category: "database",
      message: "DATABASE_URL configuration detected",
    });
  }

  // Check CSRF_TRUSTED_ORIGINS for Django 4.0+
  if (settings.csrfTrustedOrigins.length === 0) {
    issues.push({
      id: "django-no-csrf-origins",
      severity: "info",
      category: "host",
      message: "CSRF_TRUSTED_ORIGINS not set - may need for Django 4.0+",
      file: settingsPath,
      fix: {
        description: "Add Railway domain to CSRF_TRUSTED_ORIGINS",
        after: "CSRF_TRUSTED_ORIGINS = ['https://*.railway.app']",
        steps: [
          "Required for Django 4.0+ on Railway",
          "Add your Railway domain to CSRF_TRUSTED_ORIGINS",
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
        id: "django-no-gunicorn",
        severity: "error",
        category: "start-command",
        message: "gunicorn not found in requirements.txt",
        file: requirementsPath,
        fix: {
          description: "Add gunicorn for production server",
          after: "gunicorn",
          steps: [
            "Add 'gunicorn' to requirements.txt",
            "Gunicorn is required for Django production on Railway",
          ],
        },
      });
    }
  }

  return { issues, passed };
}
