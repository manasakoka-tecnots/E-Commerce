const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
      walk(fp);
    } else if (e.isFile() && (e.name === 'page.tsx' || e.name === 'layout.tsx')) {
      let content = fs.readFileSync(fp, 'utf8');
      if (content.includes('export const instant')) {
        const newContent = content.replace(/export const instant\s*=\s*false;\s*\n?/g, '');
        if (newContent !== content) {
          fs.writeFileSync(fp, newContent);
          console.log('Fixed:', fp);
        }
      }
    }
  }
}

walk(path.join(__dirname, '..', 'app'));
console.log('Done');
