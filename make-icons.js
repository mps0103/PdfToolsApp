/**
 * Generates every launcher icon density from assets/icon-512.png.
 *
 * The foreground is inset to 65% because Android masks adaptive icons to a
 * circle on most launchers — artwork that runs edge to edge loses its
 * corners, which would cut off "by MPS" and the wrench.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'assets', 'icon-512.png');
const RES = path.join(__dirname, 'android', 'app', 'src', 'main', 'res');
const RED = { r: 208, g: 39, b: 29, alpha: 1 };

// Adaptive icons are 108dp; the inner 72dp is what every launcher shows.
const DENSITIES = {
  mdpi: { legacy: 48, adaptive: 108 },
  hdpi: { legacy: 72, adaptive: 162 },
  xhdpi: { legacy: 96, adaptive: 216 },
  xxhdpi: { legacy: 144, adaptive: 324 },
  xxxhdpi: { legacy: 192, adaptive: 432 },
};

async function run() {
  if (!fs.existsSync(SRC)) {
    console.error('Missing', SRC);
    process.exit(1);
  }

  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    fs.mkdirSync(dir, { recursive: true });

    // Legacy square icon: artwork fills the whole tile.
    await sharp(SRC)
      .resize(size.legacy, size.legacy, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // Legacy round icon: same artwork, the launcher clips it.
    await sharp(SRC)
      .resize(size.legacy, size.legacy, { fit: 'cover' })
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // Adaptive foreground: artwork at 65%, centred on transparency, so the
    // circular mask never reaches the edge of the artwork itself.
    const inner = Math.round(size.adaptive * 0.65);
    const pad = Math.round((size.adaptive - inner) / 2);
    const art = await sharp(SRC).resize(inner, inner, { fit: 'contain' }).png().toBuffer();

    await sharp({
      create: {
        width: size.adaptive,
        height: size.adaptive,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: art, top: pad, left: pad }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`${density}: ${size.legacy}px legacy, ${size.adaptive}px adaptive`);
  }

  // Play listing icon.
  fs.mkdirSync(path.join(__dirname, 'store'), { recursive: true });
  await sharp(SRC)
    .resize(512, 512, { fit: 'cover', background: RED })
    .png()
    .toFile(path.join(__dirname, 'store', 'play-icon-512.png'));

  console.log('store/play-icon-512.png written');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});