# Logo & Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a professional logo and favicon for the GitHub Webhook Monitor project and integrate them across the web dashboard and documentation.

**Architecture:** Generate an SVG logo combining a GitHub webhook symbol with an AI spark (purple accent). Convert to PNG formats for different use cases (16×16, 32×32, 48×48, 192×192, 512×512). Integrate into the Express server's HTML head, create a web manifest, and update documentation.

**Tech Stack:** Node.js (sharp library for image conversion), SVG, PNG, Express.js

---

## File Structure

**New files:**
- `public/logo.svg` — Primary SVG logo (scalable)
- `public/logo-512.png` — 512×512 PNG for metadata/social
- `public/favicon.ico` — Multi-resolution ICO file
- `public/favicon-192.png` — Android home screen icon
- `public/favicon-512.png` — PWA manifest icon
- `public/manifest.json` — Web app manifest
- `scripts/generate-icons.js` — Icon generation script

**Modified files:**
- `server.js` — Add favicon/manifest routes and update HTML head
- `package.json` — Add sharp dependency
- `public/style.css` — Optional: logo styling if needed
- `README.md` — Add logo reference in header

---

## Task 1: Create SVG Logo Design

**Files:**
- Create: `public/logo.svg`

- [ ] **Step 1: Create SVG logo file with webhook + AI spark design**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="512" height="512">
  <!-- Background circle for definition -->
  <defs>
    <style>
      .webhook-shape { fill: #0969da; }
      .spark-shape { fill: #7C3AED; }
    </style>
  </defs>

  <!-- Webhook hook shape (blue) -->
  <g class="webhook-shape">
    <!-- Circular hook -->
    <path d="M 60 80 Q 50 80 50 95 Q 50 110 65 110 L 120 110 Q 130 110 130 100 L 130 70 Q 130 60 120 60 L 75 60 Q 70 60 70 65 L 70 90 M 70 110 L 70 125 Q 70 135 60 135 Q 50 135 50 125"/>
    <!-- Hook endpoint dot -->
    <circle cx="50" cy="135" r="6"/>
  </g>

  <!-- AI spark (purple) - lightning bolt in top right -->
  <g class="spark-shape">
    <path d="M 145 45 L 135 70 L 155 70 L 130 110 L 150 110 L 120 155 L 145 95 L 125 95 Z" fill="#7C3AED"/>
  </g>

  <!-- Optional: subtle connection line -->
  <line x1="130" y1="75" x2="145" y2="60" stroke="#7C3AED" stroke-width="2" opacity="0.5"/>
</svg>
```

- [ ] **Step 2: Verify SVG renders correctly**

Save the file and open it in a browser or image viewer to verify the design looks correct.

---

## Task 2: Install Image Processing Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install sharp for image conversion**

```bash
cd /Users/vega/devroot/gh-webhook-monitor
npm install sharp
```

- [ ] **Step 2: Verify sharp installed**

```bash
npm list sharp
```

Expected output: Shows sharp with version number

---

## Task 3: Create Icon Generation Script

**Files:**
- Create: `scripts/generate-icons.js`

- [ ] **Step 1: Write icon generation script**

```javascript
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = './public';

async function generateIcons() {
  console.log('🎨 Generating icons from logo.svg...');

  const sizes = [16, 32, 48, 192, 512];
  const svgPath = path.join(publicDir, 'logo.svg');

  // Generate PNG versions
  for (const size of sizes) {
    const outputPath = path.join(publicDir, `favicon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`✅ Generated ${outputPath} (${size}×${size})`);
  }

  // Generate ICO file (use 32x32 as base, include multiple sizes)
  const ico32 = await sharp(svgPath)
    .resize(32, 32)
    .png()
    .toBuffer();

  const ico16 = await sharp(svgPath)
    .resize(16, 16)
    .png()
    .toBuffer();

  // For simplicity, save 32px as favicon.ico (browsers accept PNG-in-ICO)
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico32);
  console.log('✅ Generated favicon.ico (32×32)');

  // Also generate the large PNG for logo display
  const logo512 = await sharp(svgPath)
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'logo-512.png'));
  console.log('✅ Generated logo-512.png');

  console.log('🎉 All icons generated successfully!');
}

generateIcons().catch(err => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to package.json**

Modify `package.json` scripts section:

```json
"scripts": {
  "start": "node server.js",
  "tunnel": "cloudflared tunnel --url http://localhost:3847",
  "dev": "node server.js & cloudflared tunnel --url http://localhost:3847",
  "generate-icons": "node scripts/generate-icons.js"
}
```

- [ ] **Step 3: Create scripts directory if needed**

```bash
mkdir -p /Users/vega/devroot/gh-webhook-monitor/scripts
```

- [ ] **Step 4: Run icon generation**

```bash
npm run generate-icons
```

Expected output: Success messages for each generated icon

---

## Task 4: Create Web App Manifest

**Files:**
- Create: `public/manifest.json`

- [ ] **Step 1: Write web app manifest**

```json
{
  "name": "GitHub Webhook Monitor",
  "short_name": "GH Webhook",
  "description": "Local server that receives GitHub webhook events and spawns AI agents to handle them automatically",
  "start_url": "/",
  "display": "standalone",
  "scope": "/",
  "theme_color": "#0969da",
  "background_color": "#ffffff",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/favicon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/favicon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/favicon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

---

## Task 5: Update Server HTML with Favicon & Manifest Links

**Files:**
- Modify: `server.js` (HTML head section)

- [ ] **Step 1: Locate HTML head section in server.js**

Find the section where HTML is generated (should be in the dashboard route or template). Add favicon links after opening `<head>` tag:

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="GitHub Webhook Monitor - Spawn AI agents to handle GitHub events">
<meta name="theme-color" content="#0969da">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="GH Webhook">

<!-- Favicons -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="apple-touch-icon" href="/favicon-192.png">

<!-- Web App Manifest -->
<link rel="manifest" href="/manifest.json">

<title>GitHub Webhook Monitor Dashboard</title>
```

- [ ] **Step 2: Ensure public directory is served**

Verify in `server.js` that the public directory is served statically:

```javascript
app.use(express.static('public'));
```

This should already exist, but confirm it's present.

- [ ] **Step 3: Test server starts without errors**

```bash
npm start
```

Expected: Server starts, no 404 errors for favicon requests

---

## Task 6: Update README with Logo

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add logo reference to README header**

After the h1 title, add:

```markdown
# gh-webhook-monitor

![GitHub Webhook Monitor Logo](public/logo.svg)

A local server that receives GitHub webhook events and spawns AI agents (Claude Code or Codex CLI) to handle them automatically.
```

- [ ] **Step 2: Verify README renders correctly**

Check that the logo displays in the GitHub preview by viewing the raw file.

---

## Task 7: Add Icons to .gitignore (if needed)

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Verify PNG icons are committed**

Since the SVG is the source and PNGs are generated, consider if you want to commit the PNGs or regenerate them. For this project, commit both:

- PNG files should be committed (so clones don't need Node.js to generate them)
- Keep `.gitignore` as is

No action needed if already committed.

---

## Task 8: Final Testing & Verification

**Files:**
- None (testing only)

- [ ] **Step 1: Start the server**

```bash
npm start
```

- [ ] **Step 2: Test favicon loads**

```bash
curl -I http://localhost:3847/favicon.ico
```

Expected: HTTP 200 with Content-Type: image/x-icon

- [ ] **Step 3: Test other icon sizes load**

```bash
curl -I http://localhost:3847/favicon-192.png
curl -I http://localhost:3847/manifest.json
```

Expected: All return HTTP 200

- [ ] **Step 4: Open dashboard in browser**

Navigate to `http://localhost:3847` and verify:
- Browser tab shows the webhook+spark logo
- No 404 errors in browser console for favicon requests
- Logo loads correctly in README preview on GitHub

- [ ] **Step 5: Commit all changes**

```bash
git add public/logo.svg public/favicon.ico public/manifest.json public/favicon-*.png scripts/generate-icons.js
git commit -m "feat: add logo and favicon with webhook+AI spark design

- Create SVG logo combining GitHub webhook with purple AI spark
- Generate multi-resolution PNG icons (16-512px)
- Add web app manifest for PWA support
- Integrate favicon links into dashboard HTML
- Add logo reference to README
- Include icon generation script for future updates"
```

---

## Execution Notes

- All SVG/PNG files go in the `public/` directory (served by Express)
- Sharp library handles SVG-to-PNG conversion automatically
- The icon generation script is idempotent (safe to run multiple times)
- Test in multiple browsers (favicon caching varies)
- If icons don't appear, clear browser cache (Cmd+Shift+Delete on macOS)
