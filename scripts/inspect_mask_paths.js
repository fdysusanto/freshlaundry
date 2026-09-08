const fs = require('fs');
const path = require('path');

['logo-white.svg', 'logo-dark.svg', 'logo-icon.svg', 'icon/icon.svg'].forEach(file => {
  const filePath = path.join(process.cwd(), 'public/brand/cuciyan', file.includes('/') ? file : 'logo/' + file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  console.log(`\n=== ${file} ===`);
  const paths = [...content.matchAll(/<path[^>]+d="([^"]+)"/g)];
  paths.forEach((p, i) => console.log(`Path ${i}:`, p[1].substring(0, 100)));
});
