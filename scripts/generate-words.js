const fs = require('fs');
const path = require('path');
const { MerkleTree } = require('merkletreejs');
const { keccak256 } = require('js-sha3');

function getWordList() {
  const wordListPath = path.join(__dirname, '../constants/wordList.js');

  if (!fs.existsSync(wordListPath)) {
    console.error('wordList.js not found at:', wordListPath);
    process.exit(1);
  }

  const content = fs.readFileSync(wordListPath, 'utf8');

  const match = content.match(/const WORDS = \[([\s\S]*?)\]/);
  if (!match) {
    console.error('Could not find WORDS array in wordList.js');
    process.exit(1);
  }

  const wordsString = match[1];
  const words = wordsString
    .split(',')
    .map(word => word.trim().replace(/['"]/g, ''))
    .filter(word => word.length > 0);

  return words;
}

function keccakHash(data) {
  return Buffer.from(keccak256(data), 'hex');
}

function createLeaf(word, index) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32BE(index, 0);
  const wordBuffer = Buffer.from(word.toUpperCase(), 'utf8');
  const combined = Buffer.concat([indexBuffer, wordBuffer]);
  return keccakHash(combined);
}

function createLeafAlt1(word, index) {
  return keccakHash(Buffer.from(word.toUpperCase(), 'utf8'));
}

function createLeafAlt2(word, index) {
  const indexBuffer = Buffer.alloc(4);
  indexBuffer.writeUInt32BE(index, 0);
  return keccakHash(indexBuffer);
}

function createLeafAlt3(word, index) {
  const combined = index.toString() + word.toUpperCase();
  return keccakHash(Buffer.from(combined, 'utf8'));
}

function generateWordsJson() {
  console.log('=== GENERATING WORDS.JSON (CORRECTED KECCAK256) ===');

  // Получаем список слов
  const words = getWordList();
  console.log('Total words:', words.length);
  console.log('First 5 words:', words.slice(0, 5));

  const leafVariants = [
    { name: 'uint32+string', fn: createLeaf },
    { name: 'string only', fn: createLeafAlt1 },
    { name: 'uint32 only', fn: createLeafAlt2 },
    { name: 'index_string concat', fn: createLeafAlt3 },
  ];

  for (const variant of leafVariants) {
    console.log(`\n=== TESTING VARIANT: ${variant.name} ===`);

    const leaves = words.map((word, index) => variant.fn(word, index));
    const tree = new MerkleTree(leaves, keccakHash, { sortPairs: true });
    const root = tree.getRoot();
    const rootHex = '0x' + root.toString('hex');

    console.log(`Root (${variant.name}):`, rootHex);

    let allValid = true;
    for (let i = 0; i < Math.min(3, words.length); i++) {
      const leaf = variant.fn(words[i], i);
      const proof = tree.getProof(leaf);
      const isValid = tree.verify(proof, leaf, root);
      console.log(
        `  Item ${i} (${words[i].toUpperCase()}): ${isValid ? '✅' : '❌'}`
      );
      if (!isValid) allValid = false;
    }

    if (allValid) {
      console.log(
        `✅ Variant "${variant.name}" looks good! Generating full file...`
      );

      const items = words.map((word, index) => {
        const leaf = variant.fn(word, index);
        const leafHex = '0x' + leaf.toString('hex');
        const proof = tree.getProof(leaf);
        const proofHex = proof.map(p => '0x' + p.data.toString('hex'));

        return {
          index: index,
          word: word.toUpperCase(),
          leaf: leafHex,
          proof: proofHex,
        };
      });

      const wordsData = {
        root: rootHex,
        totalWords: words.length,
        variant: variant.name,
        items: items,
      };

      const outputPath = path.join(__dirname, '../dist/words.json');
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(wordsData, null, 2));
      console.log('Saved to:', outputPath);

      const rootPath = path.join(__dirname, '../dist/merkle-root.txt');
      fs.writeFileSync(rootPath, rootHex);
      console.log('Updated merkle-root.txt:', rootHex);

      return wordsData;
    }
  }

  console.error('❌ No variant worked! Manual debugging needed.');
  process.exit(1);
}

try {
  const wordsData = generateWordsJson();
  console.log('\n=== SUCCESS ===');
  console.log('Generated words.json with variant:', wordsData.variant);
  console.log('Total words:', wordsData.items.length);
  console.log('Merkle root:', wordsData.root);
  console.log('\nNext steps:');
  console.log('1. Run: node scripts/deploy.js');
  console.log('2. Test in React app');
} catch (error) {
  console.error('Error generating words.json:', error);
  process.exit(1);
}
