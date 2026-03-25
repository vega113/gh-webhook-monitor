#!/usr/bin/env node

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const svgPath = join(projectRoot, 'public', 'logo.svg');
const publicDir = join(projectRoot, 'public');

const sizes = [16, 32, 48, 192, 512];

async function generateIcons() {
  try {
    console.log('Reading SVG logo...');
    const svgBuffer = readFileSync(svgPath);

    console.log('Generating PNG icons...');
    for (const size of sizes) {
      const outputPath = join(publicDir, `favicon-${size}.png`);
      await sharp(svgBuffer)
        .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ Generated ${outputPath}`);
    }

    console.log('Generating favicon.ico...');
    // Create favicon.ico by copying the 32x32 PNG as ICO
    // Most modern browsers accept PNG as favicon
    const faviconPngPath = join(publicDir, 'favicon-32.png');
    const faviconIcoPath = join(publicDir, 'favicon.ico');

    // Copy the PNG as .ico (browsers understand both)
    const faviconPng = readFileSync(faviconPngPath);
    writeFileSync(faviconIcoPath, faviconPng);
    console.log(`  ✓ Generated ${faviconIcoPath}`);

    console.log('\nAll icons generated successfully!');
    console.log('Generated files:');
    sizes.forEach(size => console.log(`  - public/favicon-${size}.png`));
    console.log('  - public/favicon.ico');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
