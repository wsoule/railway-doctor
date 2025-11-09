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

- **Fast scanning** - Analyzes your project in under 1 second
- **Framework detection** - Automatically detects Express, Next.js, NestJS, Django, and more
- **Actionable fixes** - Shows exact before/after code with line numbers
- **5 comprehensive checks**:
  - PORT configuration (process.env.PORT usage)
  - Host binding (0.0.0.0 requirement)
  - Start command validation
  - Environment variables detection
  - Database connection validation
- **Multiple output formats** - Human-friendly terminal output or JSON for CI/CD

## Installation

```bash
# Clone the repository
git clone https://github.com/wsoule/railway-doctor
cd railway-doctor

# Install dependencies
bun install
```

## Usage

### Scan a project

```bash
# Scan current directory
bun run src/cli.ts scan

# Scan specific directory
bun run src/cli.ts scan ./my-project

# Show all checks including passed ones
bun run src/cli.ts scan --verbose

# Output as JSON (for CI/CD)
bun run src/cli.ts scan --json
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

- **Express.js** - Full support with framework-specific checks
- **Next.js** - Full support with framework-specific checks
- **NestJS** - Full support with framework-specific checks
- **Django** - Full support (ALLOWED_HOSTS, whitenoise, gunicorn, DATABASE_URL, CSRF_TRUSTED_ORIGINS)
- **Flask** - Full support (gunicorn, Procfile, production server checks)
- **FastAPI** - Full support (uvicorn, Procfile, production server checks)

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
# Node.js Frameworks
bun run src/cli.ts scan test-projects/express-broken   # Should find 3 errors
bun run src/cli.ts scan test-projects/express-working --verbose  # Should pass
bun run src/cli.ts scan test-projects/nextjs-broken    # Should find 3 errors
bun run src/cli.ts scan test-projects/nextjs-working --verbose   # Should pass

# Python Frameworks
bun run src/cli.ts scan test-projects/django-broken    # Django deployment issues
bun run src/cli.ts scan test-projects/django-working --verbose   # Properly configured
bun run src/cli.ts scan test-projects/flask-broken     # Flask with dev server
bun run src/cli.ts scan test-projects/flask-working --verbose    # Production ready
bun run src/cli.ts scan test-projects/fastapi-broken   # FastAPI configuration issues
bun run src/cli.ts scan test-projects/fastapi-working --verbose  # Production ready
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

### Future Enhancements (v0.3.0+)
- [ ] Static files configuration checks (Django whitenoise, Express static)
- [ ] Auto-fix mode (--fix flag to automatically apply fixes)
- [ ] CI/CD integration (GitHub Action)
- [ ] Build and publish to npm
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
