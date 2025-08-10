import fs from 'fs/promises';

export async function testDashboardSmoke() {
  // Ensure index.html loads and minimal controls exist
  const html = await fs.readFile('./docs/index.html', 'utf8');
  const hasToolbar = html.includes('<header class="toolbar">');
  const hasAppJs = html.includes('app.js');
  const ok = hasToolbar && hasAppJs;
  console.log(`✅ Dashboard UI skeleton: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}


