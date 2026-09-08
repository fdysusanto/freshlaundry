const fs = require('fs');
const path = require('path');

const files = ['logo-horizontal.svg', 'logo-vertical.svg', 'logo-icon.svg', 'logo-white.svg', 'logo-dark.svg'];

files.forEach(file => {
  const p = path.join(process.cwd(), 'public/brand/cuciyan/logo', file);
  const content = fs.readFileSync(p, 'utf8');

  console.log(`\n=== ${file} ===`);
  const viewBox = content.match(/viewBox="([^"]+)"/)?.[1];
  console.log('viewBox:', viewBox);

  const clipPaths = [...content.matchAll(/clipPath[^>]*>[\s\S]*?<path[^>]+d="([^"]+)"/g)];
  clipPaths.forEach((cp, i) => {
    console.log(`clipPath ${i}:`, cp[1].trim());
  });
});
