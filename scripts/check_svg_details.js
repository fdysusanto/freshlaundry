const fs = require('fs');
const path = require('path');

['logo-horizontal.svg', 'logo-vertical.svg', 'logo-icon.svg', 'logo-white.svg', 'logo-dark.svg'].forEach(file => {
  const filePath = path.join(process.cwd(), 'public/brand/cuciyan/logo', file);
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`${file}: length=${content.length}, viewBox=${content.match(/viewBox="([^"]+)"/)?.[1]}`);
});

const iconPath = path.join(process.cwd(), 'public/brand/cuciyan/icon/icon.svg');
if (fs.existsSync(iconPath)) {
  const c = fs.readFileSync(iconPath, 'utf8');
  console.log(`icon/icon.svg: length=${c.length}, viewBox=${c.match(/viewBox="([^"]+)"/)?.[1]}`);
}
