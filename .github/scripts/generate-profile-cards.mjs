import { mkdir, writeFile } from "node:fs/promises";

const owner = "saishthakur";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required to read public repository data.");

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
};

async function getJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}): ${url}`);
  }
  return response.json();
}

const repos = await getJson(
  `https://api.github.com/users/${owner}/repos?type=owner&visibility=public&per_page=100&sort=updated`,
);
const sourceRepos = repos.filter((repo) => !repo.fork && !repo.archived);
let stars = 0;
for (const repo of sourceRepos) stars += repo.stargazers_count;

const languages = new Map();
let nextRepo = 0;
async function readLanguageWorker() {
  while (nextRepo < sourceRepos.length) {
    const repo = sourceRepos[nextRepo++];
    if (repo.size === 0) continue;
    const values = await getJson(repo.languages_url);
    for (const [name, bytes] of Object.entries(values)) {
      languages.set(name, (languages.get(name) ?? 0) + bytes);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(4, sourceRepos.length) }, readLanguageWorker));

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]);

const sharedStyle = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#071A33" />
      <stop offset="100%" stop-color="#102D52" />
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#2563EB" />
      <stop offset="100%" stop-color="#4DA3FF" />
    </linearGradient>
  </defs>
  <rect x="1" y="1" width="438" height="178" rx="16" fill="url(#bg)" stroke="#24466F" stroke-width="1.5" />
  <path d="M17 1h90" stroke="url(#accent)" stroke-width="3" stroke-linecap="round" />
`;

const statsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="180" viewBox="0 0 440 180" role="img" aria-labelledby="title desc">
  <title id="title">GitHub public profile overview</title>
  <desc id="desc">${repos.length} public repositories and ${stars} stars across non-fork, non-archived public repositories.</desc>
  ${sharedStyle}
  <text x="24" y="34" fill="#A9C9F5" font-family="Segoe UI,Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="1.6">GITHUB OVERVIEW</text>
  <text x="24" y="54" fill="#7896BD" font-family="Segoe UI,Arial,sans-serif" font-size="11">Public projects and community interest</text>
  <rect x="22" y="70" width="190" height="78" rx="12" fill="#0B2341" stroke="#1B3A61" />
  <rect x="228" y="70" width="190" height="78" rx="12" fill="#0B2341" stroke="#1B3A61" />
  <text x="40" y="105" fill="#F4F8FF" font-family="Segoe UI,Arial,sans-serif" font-size="29" font-weight="700">${repos.length}</text>
  <text x="40" y="128" fill="#9BB5D8" font-family="Segoe UI,Arial,sans-serif" font-size="12">PUBLIC REPOSITORIES</text>
  <text x="246" y="105" fill="#F4F8FF" font-family="Segoe UI,Arial,sans-serif" font-size="29" font-weight="700">${stars}</text>
  <text x="246" y="128" fill="#9BB5D8" font-family="Segoe UI,Arial,sans-serif" font-size="12">STARS · ORIGINAL PROJECTS</text>
  <text x="24" y="166" fill="#7896BD" font-family="Segoe UI,Arial,sans-serif" font-size="10">Updated daily from GitHub public repository data</text>
</svg>`;

const colors = {
  Python: "#4DA3FF", JavaScript: "#F1E05A", TypeScript: "#3178C6", "Jupyter Notebook": "#F37626",
  HTML: "#E34F26", CSS: "#563D7C", Java: "#B07219", "C++": "#F34B7D", C: "#5992B8",
  Shell: "#89E051", Go: "#00ADD8", Rust: "#DEA584", Ruby: "#701516", Kotlin: "#A97BFF",
  Swift: "#F05138", Dockerfile: "#2496ED", Makefile: "#427819", R: "#198CE7",
};
const totalBytes = [...languages.values()].reduce((sum, bytes) => sum + bytes, 0);
const topLanguages = [...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
const languageRows = topLanguages.map(([name, bytes], index) => {
  const percent = totalBytes ? (bytes / totalBytes) * 100 : 0;
  const y = 65 + index * 18;
  const width = Math.max(percent ? 3 : 0, Math.round(235 * percent / 100));
  const color = colors[name] ?? "#4DA3FF";
  return `
  <text x="24" y="${y}" fill="#DCE9FA" font-family="Segoe UI,Arial,sans-serif" font-size="11">${escapeXml(name)}</text>
  <rect x="143" y="${y - 9}" width="235" height="7" rx="3.5" fill="#173251" />
  <rect x="143" y="${y - 9}" width="${width}" height="7" rx="3.5" fill="${color}" />
  <text x="409" y="${y}" fill="#A9C9F5" text-anchor="end" font-family="Segoe UI,Arial,sans-serif" font-size="10">${percent.toFixed(1)}%</text>`;
}).join("");

const languageSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="180" viewBox="0 0 440 180" role="img" aria-labelledby="title desc">
  <title id="title">Top languages in public repositories</title>
  <desc id="desc">Language share by code bytes across non-fork, non-archived public repositories.</desc>
  ${sharedStyle}
  <text x="24" y="34" fill="#A9C9F5" font-family="Segoe UI,Arial,sans-serif" font-size="12" font-weight="700" letter-spacing="1.6">LANGUAGE MIX</text>
  <text x="24" y="52" fill="#7896BD" font-family="Segoe UI,Arial,sans-serif" font-size="10">Share of detected code bytes · public original projects</text>
  ${languageRows || '<text x="24" y="92" fill="#9BB5D8" font-family="Segoe UI,Arial,sans-serif" font-size="12">No language data available yet</text>'}
  <text x="24" y="166" fill="#7896BD" font-family="Segoe UI,Arial,sans-serif" font-size="10">Updated daily from GitHub repository language data</text>
</svg>`;

await mkdir("profile-cards", { recursive: true });
await Promise.all([
  writeFile("profile-cards/github-overview.svg", statsSvg, "utf8"),
  writeFile("profile-cards/top-languages.svg", languageSvg, "utf8"),
]);
