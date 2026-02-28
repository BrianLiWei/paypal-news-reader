const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'public/icon.svg');
const outputDir = path.join(__dirname, 'public');

async function convert() {
  const svg = fs.readFileSync(svgPath);

  // 生成 256x256 PNG
  await sharp(svg)
    .resize(256, 256)
    .png()
    .toFile(path.join(outputDir, 'icon.png'));

  console.log('✓ icon.png (256x256)');

  // 生成 512x512 PNG (用于 Apple Touch Icon)
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(path.join(outputDir, 'icon-512.png'));

  console.log('✓ icon-512.png (512x512)');

  // 生成多尺寸 ICO (Windows)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map(size =>
      sharp(svg)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );

  // 创建简单的 ICO 文件 (只包含 256x256)
  // 真正的 ICO 需要复杂格式，这里生成 256x256 PNG 重命名为 ico
  await sharp(svg)
    .resize(256, 256)
    .png()
    .toFile(path.join(outputDir, 'icon.ico.png'));

  // 重命名
  fs.renameSync(
    path.join(outputDir, 'icon.ico.png'),
    path.join(outputDir, 'icon.ico')
  );

  console.log('✓ icon.ico');

  // 更新 HTML 引用
  const htmlPath = path.join(__dirname, 'public/index.html');
  let html = fs.readFileSync(htmlPath, 'utf8');

  html = html.replace(
    'href="icon.svg"',
    'href="icon.png"'
  );

  fs.writeFileSync(htmlPath, html);
  console.log('✓ 更新 index.html 引用');

  console.log('\n所有图标生成完成！');
}

convert().catch(console.error);
