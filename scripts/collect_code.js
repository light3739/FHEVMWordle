// Скрипт для сбора исходного кода проекта в один файл
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../all_code.txt');
const ROOT_DIR = path.join(__dirname, '..');

// Игнорируемые папки и расширения
const IGNORE_DIRS = [
  'node_modules',
  '.git',
  'build',
  'dist',
  '.cache',
  '.next',
  'out',
  'bin',
  'db',
  'sqlite',
  'env',
  'test',
  'tasks',
];
const IGNORE_FILES = [
  '.DS_Store',
  '.log',
  '.lock',
  '.tmp',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.mp4',
  '.mp3',
  '.wav',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.out',
  '.bin',
  '.db',
  '.sqlite',
  '.env',
];
const IGNORE_EXT = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.ico',
  '.mp4',
  '.mp3',
  '.wav',
  '.pdf',
  '.exe',
  '.dll',
  '.so',
  '.out',
  '.bin',
  '.db',
  '.sqlite',
  '.env',
  '.zip',
  '.log',
  '.lock',
  '.tmp',
];

// Разрешённые расширения исходного кода
const CODE_EXT = [
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.scss',
  '.css',
  '.sol',
  '.json',
  '.md',
  '.html',
];

// manifest.json разрешён
const ALLOW_FILES = ['manifest.json'];

function shouldIgnore(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath);
  if (IGNORE_FILES.includes(base)) return true;
  if (IGNORE_EXT.includes(ext)) return true;
  if (base.startsWith('.')) return true;
  return false;
}

function shouldInclude(filePath) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  // Исключаем src/constants/validGuesses.js
  const relPath = path.relative(ROOT_DIR, filePath);
  if (relPath === 'src/constants/validGuesses.js') return false;
  if (CODE_EXT.includes(ext)) return true;
  if (ALLOW_FILES.includes(base)) return true;
  return false;
}

function walk(dir, files = []) {
  if (IGNORE_DIRS.some(d => dir.endsWith(d))) return files;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (IGNORE_DIRS.includes(entry)) continue;
      walk(fullPath, files);
    } else {
      if (shouldIgnore(fullPath)) continue;
      if (shouldInclude(fullPath)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function collect() {
  const files = walk(ROOT_DIR);
  let out = '';
  for (const file of files) {
    try {
      const relPath = path.relative(ROOT_DIR, file);
      const code = fs.readFileSync(file, 'utf8');
      out += `\n\n// ===== ${relPath} =====\n`;
      out += code;
    } catch (e) {
      out += `\n\n// ===== ${file} (ошибка чтения) =====\n`;
    }
  }
  fs.writeFileSync(OUTPUT_FILE, out);
  console.log(`Собрано ${files.length} файлов. Результат: ${OUTPUT_FILE}`);
}

collect();
