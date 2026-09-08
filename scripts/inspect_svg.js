const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'public/brand/cuciyan/logo');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const clipPaths = [...content.matchAll(/clipPath[^>]*>[\s\S]*?<path[^>]+d="([^"]+)"/g)];
  const masks = [...content.matchAll(/mask[^>]*>[\s\S]*?<g[^>]+transform="matrix\(([^)]+)\)"/g)];
  const images = [...content.matchAll(/<image[^>]+x="([^"]*)"[^>]+y="([^"]*)"[^>]+width="([^"]*)"[^>]+height="([^"]*)"/g)];

  console.log(`=== ${file} ===`);
  console.log('viewBox:', viewBoxMatch ? viewBoxMatch[1] : 'None');

  clipPaths.forEach((cp, i) => {
    console.log(`ClipPath ${i}:`, cp[1]);
  });

  masks.forEach((m, i) => {
    console.log(`Mask transform ${i}:`, m[1]);
  });

  images.forEach((img, i) => {
    console.log(`Image ${i}:`, `x=${img[1]} y=${img[2]} w=${img[3]} h=${img[4]}`);
  });
});
