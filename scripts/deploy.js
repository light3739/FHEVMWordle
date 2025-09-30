const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  const wordsPath = path.join(__dirname, '../dist/words.json');

  if (!fs.existsSync(wordsPath)) {
    console.error('words.json not found at:', wordsPath);
    console.log('Please make sure words.json exists with proper merkle data');
    process.exit(1);
  }

  const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8'));

  console.log('=== DEPLOY INFO ===');
  console.log('Merkle root:', wordsData.root);
  console.log('Total words:', wordsData.items.length);

  if (
    !wordsData.root ||
    wordsData.root ===
      '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    console.error('Invalid merkle root in words.json');
    process.exit(1);
  }

  const F = await hre.ethers.getContractFactory('FHEVMWordleMerkle');
  const c = await F.deploy(wordsData.root, wordsData.items.length);

  await c.waitForDeployment();
  const address = await c.getAddress();

  console.log('=== DEPLOYMENT SUCCESSFUL ===');
  console.log('Contract address:', address);
  console.log('Merkle root:', wordsData.root);
  console.log('Leaves count:', wordsData.items.length);

  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : '';

  if (envContent.includes('REACT_APP_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(
      /REACT_APP_CONTRACT_ADDRESS=.*/g,
      `REACT_APP_CONTRACT_ADDRESS=${address}`
    );
  } else {
    envContent += `\nREACT_APP_CONTRACT_ADDRESS=${address}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log('Updated .env with new contract address');

  // Верифицируем деплой
  console.log('=== VERIFICATION ===');
  const deployedRoot = await c.merkleRoot();
  const deployedLeaves = await c.merkleLeaves();

  console.log('Deployed root:', deployedRoot);
  console.log('Expected root:', wordsData.root);
  console.log('Deployed leaves:', deployedLeaves.toString());
  console.log('Expected leaves:', wordsData.items.length);

  if (deployedRoot === wordsData.root) {
    console.log('✅ Merkle root matches!');
  } else {
    console.log('❌ Merkle root mismatch!');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
