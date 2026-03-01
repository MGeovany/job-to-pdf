import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { Profile, matchProfileToJob } from './match';
import { generatePdf } from './pdf';

export async function buildPdf(jobPath: string, profilePath: string, outPath: string) {
  console.log(`Reading inputs: ${jobPath}, ${profilePath}...`);
  const jobText = fs.readFileSync(jobPath, 'utf8');
  const profileRaw = fs.readFileSync(profilePath, 'utf8');
  const profile = yaml.load(profileRaw) as Profile;

  console.log(`Matching profile to job description...`);
  const { topProjects, alignment } = matchProfileToJob(profile, jobText);

  console.log(`Score top relevant projects:`, topProjects.map(p => p.title));
  console.log(`Aligned Keywords:`, alignment);

  const data = {
    profile,
    topProjects,
    alignment
  };

  console.log(`Generating PDF context...`);
  await generatePdf(data, outPath);
  console.log(`PDF successfully generated at ${outPath}`);
}
