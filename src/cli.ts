import { Command } from 'commander';
import { buildPdf } from './build';

const program = new Command();

program
  .name('job2pdf')
  .description('Generate tailored resume PDF based on job description')
  .version('1.0.0')
  .requiredOption('-j, --job <path>', 'path to job.txt')
  .requiredOption('-p, --profile <path>', 'path to profile.yml')
  .requiredOption('-o, --out <path>', 'output pdf path')
  .action(async (options) => {
    try {
      await buildPdf(options.job, options.profile, options.out);
    } catch (err: any) {
      console.error('Error generating PDF:', err.message);
      process.exit(1);
    }
  });

program.parse();
