const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, '../../../frontend/src/app/page.js');

console.log('Applying safe JSON parsing refactoring to page.js to prevent "Unexpected token I" frontend crashes...');

if (!fs.existsSync(pagePath)) {
  console.error(`Page not found at: ${pagePath}`);
  process.exit(1);
}

let content = fs.readFileSync(pagePath, 'utf8');

// 1. Define the safeParseJson helper function inside ShipSyncApp component
// Let's locate the beginning of ShipSyncApp and insert the helper
const componentStartPattern = `export default function ShipSyncApp() {`;
const helperDefinition = `
export default function ShipSyncApp() {
  // Safe JSON parser helper to prevent "Unexpected token I" console crashes on HTML/text 500 error pages
  const safeParseJson = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      return { message: text || 'Internal Server Error' };
    }
  };
`;
content = content.replace(componentStartPattern, helperDefinition);

// 2. Safely replace res.json(), resData.json(), resSlabs.json(), resZones.json()
content = content
  .replace(/await\s+res\.json\(\)/g, 'await safeParseJson(res)')
  .replace(/await\s+resData\.json\(\)/g, 'await safeParseJson(res)')
  .replace(/await\s+resSlabs\.json\(\)/g, 'await safeParseJson(resSlabs)')
  .replace(/await\s+resZones\.json\(\)/g, 'await safeParseJson(resZones)');

fs.writeFileSync(pagePath, content, 'utf8');
console.log('Successfully applied safe JSON response parsing to page.js!');
