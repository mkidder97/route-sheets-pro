
# Fix: Eliminate Flash of Unstyled Background on Cold Load

## Problem
The "peachy brown" background appears on cold starts because:
- The `<body>` and `<html>` tags have no inline background color
- Tailwind CSS is bundled inside the JS module and doesn't load until React boots
- During the gap between HTML render and JS execution, the browser shows its default background (Safari on macOS often renders a warm beige/peach)
- This is a classic FOUC (Flash of Unstyled Content) specific to Vite SPA apps

## Why Previous Fixes Didn't Stick
- Adding `class="dark"` to `<html>` does nothing without the CSS that defines what `dark` means
- `document.documentElement.classList.add("dark")` runs too late (after React loads)
- Both fixes only work once Tailwind CSS is already loaded — they don't help the pre-CSS window

## Solution
Two changes, both in `index.html`:

### 1. Add inline `style` to `<html>` and `<body>`
Set `background-color` directly so the browser paints the correct dark color immediately, before any CSS/JS loads:

```html
<html lang="en" class="dark" style="background-color: #0F172A;">
  ...
  <body style="background-color: #0F172A; color: #F1F5F9;">
```

`#0F172A` = `rgb(15, 23, 42)` = your `--background` value. This is painted instantly by the browser, zero dependencies.

### 2. Add a `<style>` block in `<head>` for the loading spinner
Move the spinner's critical styles inline so the loading state also looks correct before Tailwind loads.

## Files Changed
- `index.html` — add inline styles to `<html>` and `<body>` tags

## No Other Changes
This is a one-line HTML fix. No React, Tailwind, or component changes needed.
