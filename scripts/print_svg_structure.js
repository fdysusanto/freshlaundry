const fs = require('fs');
const path = require('path');

function printSVGStructure(file) {
  const filePath = path.join(process.cwd(), 'public/brand/cuciyan/logo', file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip out long base64 image data for readability
  content = content.replace(/data:image\/png;base64,[^"]+/g, '[BASE64_DATA]');
  console.log(`\n================ ${file} ================`);
  console.log(content);
}

['logo-horizontal.svg', 'logo-vertical.svg', 'logo-icon.svg', 'logo-white.svg', 'logo-dark.svg'].forEach(printSVGStructure);
