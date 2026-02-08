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

    return `    <a href="${game.path}/core.html" class="game-card">
      <div class="game-title">${game.title}</div>
      <p class="game-desc">${game.subtitle}</p>
    </a>`;
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
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .game-card {
    display: block;
    padding: 24px;
    border: 1px solid var(--divider);
    background: var(--parchment-dark);
    text-decoration: none;
    transition: border-color 0.2s;
  }

  .game-card:hover {
    border-color: var(--gold);
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

  .game-desc {
    margin-bottom: 0;
    color: var(--grey-text);
  }
</style>
</head>
<body>
<article class="manuscript">

  <div class="title-block">
    <h1>TTRPGs</h1>
    <div class="subtitle">A Collection of Tabletop Games</div>
  </div>

  <div class="game-list">
${gameListItems}
  </div>

  <div class="ornament">❧ ❧ ❧</div>

</article>
</body>
</html>
`;
}

// Inject settings and expansion links into core.html
function injectContentLinks(game) {
  if (game.settings.length === 0 && game.expansions.length === 0) return;

  let content = fs.readFileSync(game.corePath, 'utf8');

  // Remove existing settings-links sections (there may be multiple)
  content = content.replace(/\s*<div class="settings-links">[\s\S]*?<\/div>\s*(?=<div class="settings-links">|<div class="ornament">|<div class="colophon">|<\/article>)/g, '\n\n  ');

  let linksHtml = '';

  // Build settings links
  if (game.settings.length > 0) {
    const settingsLinks = game.settings.map(s =>
      `<a href="Settings/${s.file}">${s.name}</a>`
    ).join('\n    ');

    linksHtml += `<div class="settings-links">
    <span class="settings-label">Settings</span>
    ${settingsLinks}
  </div>

  `;
  }

  // Build expansion links
  if (game.expansions.length > 0) {
    const expansionLinks = game.expansions.map(e =>
      `<a href="Expansions/${e.file}">${e.name}</a>`
    ).join('\n    ');

    linksHtml += `<div class="settings-links">
    <span class="settings-label">Expansions</span>
    ${expansionLinks}
  </div>

  `;
  }

  // Insert before ornament, colophon, or closing article
  if (content.includes('<div class="ornament">')) {
    content = content.replace('<div class="ornament">', linksHtml + '<div class="ornament">');
  } else if (content.includes('<div class="colophon">')) {
    content = content.replace('<div class="colophon">', linksHtml + '<div class="colophon">');
  } else {
    content = content.replace('</article>', linksHtml + '</article>');
  }

  fs.writeFileSync(game.corePath, content);
  console.log(`  Injected content links into ${game.name}/core.html`);
}

// Inject back button into settings and expansion files
function injectBackButtons(game) {
  const allContent = [
    ...game.settings.map(s => ({ ...s, folder: 'Settings' })),
    ...game.expansions.map(e => ({ ...e, folder: 'Expansions' }))
  ];

  for (const item of allContent) {
    const itemPath = path.join(ROOT, item.path);
    let content = fs.readFileSync(itemPath, 'utf8');

    // Remove existing back-link
    content = content.replace(/\s*<a class="back-link"[^>]*>[^<]*<\/a>\s*/g, '');

    const backHtml = `<a class="back-link" href="../core.html">\u2190 Back to Core Rules</a>\n`;

    // Insert after opening article tag
    if (content.includes('<article class="manuscript">')) {
      content = content.replace('<article class="manuscript">', '<article class="manuscript">\n\n  ' + backHtml);
    }

    fs.writeFileSync(itemPath, content);
  }
  if (game.settings.length > 0) {
    console.log(`  Injected back buttons into ${game.name}/Settings/`);
  }
  if (game.expansions.length > 0) {
    console.log(`  Injected back buttons into ${game.name}/Expansions/`);
  }
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

console.log('\nInjecting content links into core files...');
games.forEach(injectContentLinks);

console.log('\nInjecting back buttons into settings and expansion files...');
games.forEach(injectBackButtons);

console.log('\nBuild complete!');
