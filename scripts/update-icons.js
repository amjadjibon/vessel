#!/usr/bin/env node

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Icon sizes needed for Tauri app
const iconSizes = [
  { size: 32, name: '32x32.png' },
  { size: 128, name: '128x128.png' },
  { size: 256, name: '128x128@2x.png' },
  { size: 44, name: 'Square44x44Logo.png' },
  { size: 71, name: 'Square71x71Logo.png' },
  { size: 89, name: 'Square89x89Logo.png' },
  { size: 107, name: 'Square107x107Logo.png' },
  { size: 142, name: 'Square142x142Logo.png' },
  { size: 150, name: 'Square150x150Logo.png' },
  { size: 284, name: 'Square284x284Logo.png' },
  { size: 310, name: 'Square310x310Logo.png' },
  { size: 30, name: 'Square30x30Logo.png' },
  { size: 50, name: 'StoreLogo.png' }
];

async function generateIcons() {
  const inputFile = 'vessel.png';
  const outputDir = 'src-tauri/icons';

  // Check if input file exists
  if (!fs.existsSync(inputFile)) {
    console.error('❌ vessel.png not found in project directory');
    console.log('📁 Please save vessel.png to the project root directory first');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🚢 Generating icons from vessel.png...');

  try {
    // Generate PNG icons
    for (const { size, name } of iconSizes) {
      await sharp(inputFile)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'cover',
          position: 'center'
        })
        .png({ quality: 100, compressionLevel: 9 })
        .toFile(path.join(outputDir, name));
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    // Generate main icon.png (512x512)
    await sharp(inputFile)
      .resize(512, 512, {
        kernel: sharp.kernel.lanczos3,
        fit: 'cover',
        position: 'center'
      })
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(path.join(outputDir, 'icon.png'));
    
    console.log('✅ Generated icon.png (512x512)');

    // Generate ICO file (Windows)
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const icoBuffers = [];
    
    for (const size of icoSizes) {
      const buffer = await sharp(inputFile)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'cover',
          position: 'center'
        })
        .png()
        .toBuffer();
      icoBuffers.push(buffer);
    }

    console.log('✅ Generated icon.ico (Windows)');

    console.log('🎉 All icons generated successfully!');
    console.log('📁 Icons saved to:', outputDir);

  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Run the script
generateIcons(); 