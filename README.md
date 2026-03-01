# job2pdf

A complete, 100% local, CLI-driven tool to generate tailored portfolio PDFs based on a job description.

## Requirements
- Node.js (v18+ recommended)
- pnpm

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Playwright browser binaries (for PDF generation):
   ```bash
   pnpm exec playwright install chromium
   ```

3. Run the generator:
   ```bash
   pnpm run build -- --job job.txt --profile profile.yml --out outputs/output.pdf
   ```

## Modifying the Template
- Edit `templates/portfolio.html` to change the layout.
- Edit `templates/styles.css` to change the colors, typography, or spacing.

## Data
- Add your actual profile to `profile.yml`.
- Paste the job description you are applying for into `job.txt`.
