# Railway Deployment Doctor

> Diagnose Railway deployment issues before you deploy

A CLI tool that scans your project and identifies common Railway deployment problems BEFORE you deploy. Think of it as a pre-flight checklist that catches mistakes early and saves you debugging time.

## The Problem

Deploying to Railway often fails due to common, preventable configuration issues:
- Hardcoded ports instead of using `process.env.PORT`
- Binding to `localhost` instead of `0.0.0.0`
- Missing or incorrect start scripts
- Development tools in production scripts

Railway Doctor catches these issues locally in seconds, with actionable fix suggestions.

## Features

- **Framework-agnostic** - Works with ANY Node.js or Python project, not just known frameworks
- **Fast scanning** - Analyzes your entire project in under 1 second
- **Multi-file analysis** - Scans all source files, not just entry points
- **Framework detection** - Automatically detects 10+ frameworks (SvelteKit, Remix, Next.js, Django, and more)
- **Actionable fixes** - Shows exact before/after code with line numbers
- **5 comprehensive checks**:
  - PORT configuration (process.env.PORT usage)
  - Host binding (0.0.0.0 requirement)
  - Start command validation
  - Environment variables detection
  - Database connection validation
- **Multiple output formats** - Human-friendly terminal output or JSON for CI/CD

## Installation

Install globally with npm:

```bash
npm install -g railway-doctor
```

Or use directly without installing (via npx):

```bash
npx railway-doctor scan
```

With Bun:

```bash
bunx railway-doctor scan
```

### For Development

To contribute or run from source:

```bash
# Clone the repository
git clone https://github.com/wsoule/railway-doctor
cd railway-doctor

# Install dependencies
bun install

# Run directly
bun run src/cli.ts scan
```

## Usage

### Scan a project

```bash
# Scan current directory
railway-doctor scan

# Scan specific directory
railway-doctor scan ./my-project

# Show all checks including passed ones
railway-doctor scan --verbose

# Output as JSON (for CI/CD)
railway-doctor scan --json
```

**Using npx** (no installation required):

```bash
# Scan current directory
npx railway-doctor scan

# Scan specific directory
npx railway-doctor scan ./my-project
```

### Example Output

```
Railway Deployment Doctor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Framework detected: express
Entry point: server.js

[ERROR] Found 3 errors

[X] Hardcoded port 3000. Railway requires process.env.PORT
   File: server.js:5

   Fix: Use process.env.PORT with a fallback for local development

   - const port = 3000;
   + const port = process.env.PORT || 3000;

[X] App binds to localhost/127.0.0.1, which won't work on Railway
   File: server.js:12

   Fix: Bind to 0.0.0.0 to accept external connections

   - app.listen(port, 'localhost')
   + app.listen(port, "0.0.0.0")

[X] No "start" script found in package.json
   File: package.json

   Fix: Add start script for Express

   + "scripts": {
  "start": "node server.js"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total checks: 3
  Passed: 0
  Warnings: 0
  Errors: 3

Deployment Likelihood: WILL FAIL
   Fix the 3 errors above before deploying.
```

## Supported Frameworks

Railway Doctor now works with **ANY Node.js or Python project**, not just specific frameworks!

### Fully Supported with Framework-Specific Checks:
- **SvelteKit** - Full support for modern Svelte apps
- **Remix** - Full support for Remix apps
- **Astro** - Full support for Astro sites
- **Nuxt** - Full support for Nuxt.js apps
- **Next.js** - Full support with framework-specific checks
- **Express.js** - Full support with framework-specific checks
- **NestJS** - Full support with framework-specific checks
- **Django** - Full support (ALLOWED_HOSTS, whitenoise, gunicorn, DATABASE_URL, CSRF_TRUSTED_ORIGINS)
- **Flask** - Full support (gunicorn, Procfile, production server checks)
- **FastAPI** - Full support (uvicorn, Procfile, production server checks)

### Generic Support:
Even if your framework isn't listed above, Railway Doctor will still scan your project for:
- Hardcoded ports and missing `process.env.PORT` usage
- Incorrect host binding (localhost vs 0.0.0.0)
- Missing start/build scripts
- Environment variable usage
- Database configuration issues

This means it works with **Hono, Elysia, Koa, Fastify, SolidStart, Qwik**, and any other Node.js/Python framework!

## What It Checks

### 1. PORT Configuration
- Detects hardcoded ports (3000, 8000, etc.)
- Ensures `process.env.PORT` is used
- Framework-specific checks (Next.js `--port` flag, etc.)

### 2. Host Binding
- Detects localhost/127.0.0.1 binding
- Ensures 0.0.0.0 binding for Railway
- Framework-specific checks (Next.js `--hostname` flag)

### 3. Start Command
- Validates "start" script exists in package.json
- Detects development tools in production (nodemon, ts-node-dev)
- Ensures build scripts exist for Next.js/NestJS
- Python: Checks for Procfile and production servers (gunicorn/uvicorn)

### 4. Environment Variables
- Scans code for `process.env.*` references
- Detects env var usage in Python (os.environ)
- Checks if .env is properly in .gitignore
- Lists all env vars that should be set in Railway

### 5. Database Configuration
- Detects database libraries (PostgreSQL, MySQL, MongoDB, Prisma, etc.)
- Flags localhost/127.0.0.1 database connections
- Checks for Unix socket connections (won't work on Railway)
- Verifies DATABASE_URL env var usage
- Suggests Railway database service integration

### Framework-Specific Checks

**Django:**
- ALLOWED_HOSTS validation (must include Railway domains or *)
- Whitenoise static files middleware configuration
- DEBUG setting (should be False in production)
- STATIC_ROOT configuration
- CSRF_TRUSTED_ORIGINS for Django 4.0+
- dj-database-url usage
- Gunicorn in requirements.txt

**Flask:**
- Gunicorn production server (not Flask development server)
- Procfile validation (gunicorn, 0.0.0.0, $PORT)
- Debug mode detection (app.run(debug=True) warnings)

**FastAPI:**
- Uvicorn production server configuration
- Procfile validation (uvicorn, --host 0.0.0.0, --port $PORT)
- Development mode warnings (uvicorn.run() detection)
- Workers recommendation for production

## Testing

Try the included test projects:

```bash
# Known Frameworks
railway-doctor scan test-projects/express-broken   # Should find 3 errors
railway-doctor scan test-projects/express-working --verbose  # Should pass
railway-doctor scan test-projects/nextjs-broken    # Should find 3 errors
railway-doctor scan test-projects/nextjs-working --verbose   # Should pass
railway-doctor scan test-projects/sveltekit-test --verbose   # SvelteKit support

# Python Frameworks
railway-doctor scan test-projects/django-broken    # Django deployment issues
railway-doctor scan test-projects/django-working --verbose   # Properly configured
railway-doctor scan test-projects/flask-broken     # Flask with dev server
railway-doctor scan test-projects/flask-working --verbose    # Production ready
railway-doctor scan test-projects/fastapi-broken   # FastAPI configuration issues
railway-doctor scan test-projects/fastapi-working --verbose  # Production ready

# Generic/Unknown Frameworks (still works!)
railway-doctor scan test-projects/generic-nodejs    # Generic Node.js - finds issues
```

## Project Structure

```
railway-doctor/
├── src/
│   ├── cli.ts                    # CLI entry point
│   ├── types.ts                  # TypeScript interfaces
│   ├── scanner/
│   │   ├── index.ts              # Main scanner orchestrator
│   │   └── fileDetector.ts       # Framework detection
│   ├── checks/
│   │   ├── portCheck.ts          # PORT configuration check
│   │   ├── hostCheck.ts          # Host binding check
│   │   └── startCommandCheck.ts  # Start script validation
│   └── output/
│       └── formatter.ts          # Terminal output formatting
├── test-projects/                # Example projects for testing
│   ├── express-broken/
│   └── express-working/
└── package.json
```

## Development

Built with:
- **Bun** - Fast JavaScript runtime
- **TypeScript** - Type safety
- **Commander** - CLI framework
- **Chalk** - Terminal colors
- **@babel/parser** - JavaScript/TypeScript AST parsing

## Roadmap

### v0.1.0 (Complete)
- [x] Framework detection (Express, Next.js, NestJS, Django, Flask, FastAPI)
- [x] PORT configuration check with AST parsing
- [x] Host binding check
- [x] Start command validation
- [x] Environment variable detection
- [x] Database connection checks
- [x] Colored terminal output
- [x] JSON output mode
- [x] Test projects for Express and Next.js

### v0.2.0 (Complete)
- [x] Django full support (ALLOWED_HOSTS, whitenoise, CSRF_TRUSTED_ORIGINS)
- [x] Flask full support (gunicorn, Procfile validation)
- [x] FastAPI full support (uvicorn, Procfile validation)
- [x] Python code analyzer for framework detection
- [x] Test projects for Django, Flask, and FastAPI
- [x] Framework-specific checks integration

### v0.3.0 (Complete - Latest)
- [x] **Framework-agnostic architecture** - Works on ANY Node.js/Python project
- [x] **Multi-file scanning** - Scans all source files, not just entry points
- [x] **Modern framework support** - SvelteKit, Remix, Astro, Nuxt detection
- [x] Refactored PORT and host checks for comprehensive coverage
- [x] Standardized check interfaces for consistency
- [x] No more "unknown framework" dead-ends
- [x] **Published to npm** - Available via `npm install -g railway-doctor`

### Future Enhancements (v0.4.0+)
- [ ] Static files configuration checks (Django whitenoise, Express static)
- [ ] Auto-fix mode (--fix flag to automatically apply fixes)
- [ ] CI/CD integration (GitHub Action)
- [ ] More frameworks (Ruby, Go, Rust)
- [ ] Railway config file generation (railway.json/railway.toml)
- [ ] Web version for online scanning

## Contributing

Contributions welcome! This tool catches common deployment issues based on real Railway deployment failures. If you've encountered a deployment issue that could be detected automatically, please open an issue or PR.

## License

MIT

## Author

Built as a solution to prevent common Railway deployment failures and save developers time debugging configuration issues.

---

**Note:** This tool is a diagnostic utility and is not officially affiliated with Railway. It's a community tool built to help developers deploy successfully.
