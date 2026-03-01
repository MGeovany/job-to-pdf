import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

export async function generatePdf(data: any, outputPath: string) {
  // Use path.resolve or join to find templates relative to the project root
  const templatePath = path.resolve(__dirname, '../templates/portfolio.html');
  const cssPath = path.resolve(__dirname, '../templates/styles.css');

  let html = fs.readFileSync(templatePath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  html = html.replace('<!-- INJECT_CSS -->', `<style>\n${css}\n</style>`);

  html = html.replace('{{NAME}}', data.profile.name || '');
  html = html.replace('{{TITLE}}', data.profile.title || '');
  html = html.replace('{{LOCATION}}', data.profile.location || '');

  const linksHtml = data.profile.links.map((l: any) => `<a href="${l.url}">${l.label}</a>`).join(' | ');
  html = html.replace('{{LINKS}}', linksHtml);

  html = html.replace('{{SUMMARY}}', data.profile.summary || '');

  const keywordsHtml = data.alignment.map((k: string) => `<span class="badge keyword-badge">${k}</span>`).join('');
  html = html.replace('{{ALIGNMENT}}', keywordsHtml);

  const skillsHtml = data.profile.skills.map((s: any) => `
    <div class="skill-category">
      <strong>${s.category}:</strong> ${s.items.join(', ')}
    </div>
  `).join('');
  html = html.replace('{{SKILLS}}', skillsHtml);

  const projectsHtml = data.topProjects.map((p: any) => `
    <div class="project">
      <h3>${p.title}</h3>
      <p class="tech-stack">${p.tech.join(' • ')}</p>
      <p>${p.description}</p>
    </div>
  `).join('');
  html = html.replace('{{PROJECTS}}', projectsHtml);

  const date = new Date().toLocaleDateString();
  html = html.replace('{{DATE}}', date);

  // Make sure output directory exists
  const outDir = path.dirname(outputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });

  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });

  await browser.close();
}
