export interface Project {
  title: string;
  tech: string[];
  description: string;
}

export interface Profile {
  name: string;
  title: string;
  location: string;
  links: { label: string; url: string }[];
  summary: string;
  skills: { category: string; items: string[] }[];
  projects: Project[];
}

export function extractKeywords(text: string): string[] {
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const freqs: Record<string, number> = {};

  // Basic stop words to ignore
  const stopWords = ['this', 'that', 'with', 'from', 'your', 'have', 'more', 'will', 'about', 'what', 'when', 'where', 'they'];

  for (const w of words) {
    if (stopWords.includes(w)) continue;
    freqs[w] = (freqs[w] || 0) + 1;
  }

  const sorted = Object.entries(freqs).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 20).map(x => x[0]);
}

export function scoreProject(project: Project, keywords: string[]): number {
  let score = 0;
  const text = `${project.title} ${project.tech.join(' ')} ${project.description}`.toLowerCase();
  for (const kw of keywords) {
    if (text.includes(kw)) score++;
  }
  return score;
}

export function matchProfileToJob(profile: Profile, jobText: string) {
  const keywords = extractKeywords(jobText);

  const scored = profile.projects.map(p => ({
    project: p,
    score: scoreProject(p, keywords)
  }));

  scored.sort((a, b) => b.score - a.score);
  const topProjects = scored.slice(0, 4).map(s => s.project);

  const profileText = JSON.stringify(profile).toLowerCase();
  const alignment = keywords.filter(kw => profileText.includes(kw)).slice(0, 10);

  return {
    topProjects,
    alignment
  };
}
