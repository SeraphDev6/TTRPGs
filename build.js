#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const IGNORE = ['node_modules', '.git', 'build.js', 'index.html'];

// Find all games (directories with a core.html)
function findGames() {
  const games = [];

  const entries = fs.readdirSync(ROOT, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORE.includes(entry.name)) continue;

    const gameDir = path.join(ROOT, entry.name);
    const corePath = path.join(gameDir, 'core.html');

    if (fs.existsSync(corePath)) {
      const game = {
        name: entry.name,
        path: entry.name,
        corePath: corePath,
        settings: findSubcontent(gameDir, entry.name, 'Settings'),
        expansions: findSubcontent(gameDir, entry.name, 'Expansions')
      };

      // Extract title and description from core.html
      const coreContent = fs.readFileSync(corePath, 'utf8');
      const titleMatch = coreContent.match(/<h1>([^<]+)<\/h1>/);
      const subtitleMatch = coreContent.match(/<div class="subtitle">([^<]+)<\/div>/);

      game.title = titleMatch ? titleMatch[1] : entry.name;
      game.subtitle = subtitleMatch ? subtitleMatch[1] : '';

      games.push(game);
    }
  }

  return games;
}

// Find all subcontent (Settings or Expansions) for a game
function findSubcontent(gameDir, gameName, folderName) {
  const items = [];
  const subDir = path.join(gameDir, folderName);

  if (!fs.existsSync(subDir)) return items;

  const entries = fs.readdirSync(subDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;

    const itemPath = path.join(subDir, entry.name);
    const content = fs.readFileSync(itemPath, 'utf8');

    const titleMatch = content.match(/<h1>([^<]+)<\/h1>/);
    const name = titleMatch ? titleMatch[1] : entry.name.replace('.html', '');

    items.push({
      name: name,
      file: entry.name,
      path: `${gameName}/${folderName}/${entry.name}`
    });
  }

  return items;
}

// Generate index.html (shows Expansions, not Settings)
function generateIndex(games) {
  const gameListItems = games.map(game => {
    const expansionLinks = game.expansions.map(e =>
      `        <a href="${e.path}">${e.name}</a>`
    ).join('\n');

    return `    <li>
      <div class="game-title"><a href="${game.path}/core.html">${game.title}</a></div>
      <p class="game-desc">${game.subtitle}</p>
      <div class="game-links">
        <a href="${game.path}/core.html">Core Rules</a>
${expansionLinks}
      </div>
    </li>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TTRPGs</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=IM+Fell+English+SC&display=swap" rel="stylesheet">
<link rel="stylesheet" href="Bound/styles.css">
<style>
  .game-list {
    list-style: none;
    padding: 0;
    margin: 40px 0;
  }

  .game-list li {
    margin-bottom: 30px;
    padding-bottom: 30px;
    border-bottom: 1px solid var(--divider);
  }

  .game-list li:last-child {
    border-bottom: none;
  }

  .game-title {
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 1.5em;
    color: var(--blood);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }

  .game-title a {
    color: inherit;
    text-decoration: none;
  }

  .game-title a:hover {
    color: var(--gold);
  }

  .game-desc {
    margin-bottom: 12px;
    color: var(--grey-text);
  }

  .game-links {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }

  .game-links a {
    font-family: 'IM Fell English SC', serif;
    font-size: 0.9em;
    color: var(--gold);
    text-decoration: none;
    letter-spacing: 0.1em;
  }

  .game-links a:hover {
    color: var(--blood);
  }
</style>
</head>
<body>
<article class="manuscript">

  <div class="title-block">
    <h1>TTRPGs</h1>
    <div class="subtitle">A Collection of Tabletop Games</div>
  </div>

  <ul class="game-list">
${gameListItems}
  </ul>

  <div class="ornament">❧ ❧ ❧</div>

</article>
</body>
</html>
`;
}

// Inject settings links into core.html
function injectSettingsLinks(game) {
  if (game.settings.length === 0) return;

  let content = fs.readFileSync(game.corePath, 'utf8');

  // Remove existing settings-links section
  content = content.replace(/\s*<div class="settings-links">[\s\S]*?<\/div>\s*(?=<div class="ornament">|<div class="colophon">|<\/article>)/g, '\n\n  ');

  // Build settings links HTML
  const links = game.settings.map(s =>
    `<a href="Settings/${s.file}">${s.name}</a>`
  ).join('\n    ');

  const settingsHtml = `<div class="settings-links">
    <span class="settings-label">Settings</span>
    ${links}
  </div>

  `;

  // Insert before ornament, colophon, or closing article
  if (content.includes('<div class="ornament">')) {
    content = content.replace('<div class="ornament">', settingsHtml + '<div class="ornament">');
  } else if (content.includes('<div class="colophon">')) {
    content = content.replace('<div class="colophon">', settingsHtml + '<div class="colophon">');
  } else {
    content = content.replace('</article>', settingsHtml + '</article>');
  }

  fs.writeFileSync(game.corePath, content);
  console.log(`  Injected settings links into ${game.name}/core.html`);
}

// Main
console.log('Building TTRPG index...\n');

const games = findGames();
console.log(`Found ${games.length} game(s):`);
games.forEach(g => {
  console.log(`  - ${g.title} (${g.settings.length} setting(s), ${g.expansions.length} expansion(s))`);
});

console.log('\nGenerating index.html...');
const indexHtml = generateIndex(games);
fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml);
console.log('  Done');

console.log('\nInjecting settings links into core files...');
games.forEach(injectSettingsLinks);

console.log('\nBuild complete!');
