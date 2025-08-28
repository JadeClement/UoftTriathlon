const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'routes');
const routeFiles = fs.readdirSync(routesDir).filter(file => file.endsWith('.js'));

routeFiles.forEach(file => {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove router.options blocks
  content = content.replace(/\/\/ Handle CORS preflight requests for all .*? routes\s+router\.options\('\*', \(req, res\) => \{\s+.*?res\.status\(200\)\.end\(\);\s+\}\);?\s+/gs, '// CORS is handled by main server middleware\n');
  
  // Remove any remaining router.options calls
  content = content.replace(/router\.options\('\*', \(req, res\) => \{\s+.*?res\.status\(200\)\.end\(\);\s+\}\);?\s*/gs, '');
  
  fs.writeFileSync(filePath, content);
  console.log(`✅ Removed CORS headers from ${file}`);
});

console.log('✅ All duplicate CORS headers removed!');
