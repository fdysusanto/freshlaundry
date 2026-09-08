const fs = require('fs');
const path = require('path');

function analyzeSVG(fileName) {
  const filePath = path.join(process.cwd(), 'public/brand/cuciyan/logo', fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  console.log(`\n=== Analyzing ${fileName} ===`);
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  console.log('Original viewBox:', viewBoxMatch ? viewBoxMatch[1] : 'None');

  // Find all path 'd' attributes
  const dMatches = [...content.matchAll(/d="([^"]+)"/g)];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  dMatches.forEach(m => {
    const coords = m[1].match(/[-+]?\d*\.?\d+/g);
    if (coords) {
      for (let i = 0; i < coords.length - 1; i += 2) {
        const x = parseFloat(coords[i]);
        const y = parseFloat(coords[i+1]);
        if (!isNaN(x) && !isNaN(y)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  });

  console.log(`Path Coordinate Bounds: minX=${minX}, minY=${minY}, maxX=${maxX}, maxY=${maxY}`);
  console.log(`Artwork size: width=${maxX - minX}, height=${maxY - minY}`);
}

['logo-horizontal.svg', 'logo-vertical.svg', 'logo-icon.svg', 'logo-white.svg', 'logo-dark.svg'].forEach(analyzeSVG);
