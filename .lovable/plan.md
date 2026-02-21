

# Add "Remember Me" to Login

## Overview
Add a "Remember me" checkbox to the login form that saves the user's email in localStorage. On return visits, the email field is pre-populated. This works alongside the browser's native credential autofill (already enabled via `autoComplete` attributes).

## Why This Approach
- Browser autofill (via `autoComplete="email"` and `autoComplete="current-password"`) is already the most secure way to suggest credentials -- it's built into Chrome, Safari, Firefox, and password managers.
- A "Remember me" checkbox adds a visible convenience layer by pre-filling the email field on return visits.
- Passwords are **never** stored in localStorage -- only the email, and only when the user opts in.

## Changes (single file: `src/pages/Login.tsx`)

### 1. Add "rememberMe" state and load saved email on mount
- Add `rememberMe` boolean state, initialized from `localStorage.getItem("roofroute_remember_me") === "true"`
- On mount, if remembered, pre-fill the email field from `localStorage.getItem("roofroute_saved_email")`

### 2. Save or clear email on successful sign-in
- In `handleSubmit`, after a successful sign-in (no error), save or remove the email and preference in localStorage based on the checkbox state.

### 3. Add checkbox UI between the password field and the Sign In button
```
[x] Remember me
```
Uses the existing Checkbox component from the UI library, styled inline with the form.

### 4. Ensure autocomplete attributes are optimal
- Add `autoComplete="username"` as a secondary hint on the email field (some password managers prefer this)
- Existing `autoComplete="current-password"` on password is already correct

## Security Notes
- Only the email address is stored in localStorage, never the password
- The `roofroute_` prefix follows the existing local storage convention
- Browser-native credential managers handle password autofill securely
- Users can uncheck "Remember me" to clear the stored email

