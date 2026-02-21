

# Automated Security Linting via GitHub Actions

## Overview
Add `eslint-plugin-security` as a dev dependency, configure security rules as warnings in the ESLint config, and create a GitHub Actions workflow that fails on any warnings.

## Files to Create/Modify

### 1. `package.json` -- add dev dependency
- Add `eslint-plugin-security` as a devDependency

### 2. `eslint.config.js` -- add security plugin and rules
- Import `eslint-plugin-security`
- Register it in the `plugins` object as `"security"`
- Add these rules (all as `"warn"`):
  - `security/detect-object-injection`
  - `security/detect-non-literal-regexp`
  - `security/detect-unsafe-regex`
  - `security/detect-buffer-noassert`
  - `security/detect-eval-with-expression`
  - `security/detect-no-csrf-before-method-override`
  - `security/detect-possible-timing-attacks`

### 3. `.github/workflows/security-lint.yml` -- new file
- Triggers: `push` to `main`, `pull_request` to `main`
- Steps:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` with `node-version: 20`
  3. `npm install`
  4. `npx eslint . --max-warnings 0`

This ensures any security warning fails the CI build. No application code is changed.

