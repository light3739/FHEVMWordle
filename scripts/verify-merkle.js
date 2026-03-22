const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const CONTRACT_ADDRESS = '0xFA23f4beB2238261011Edec693e08871732a0108'; // Replace if different
const RPC_URL = 'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY;
const WORDS_FILE = path.join(__dirname, '../public/dist/words.json');

async function verify() {
  console.log('=== MERKLE VERIFICATION DEBUG ===');

  // 1. Read local root from words.json
  if (!fs.existsSync(WORDS_FILE)) {
    console.error(`❌ Local words.json not found at ${WORDS_FILE}`);
  } else {
    const wordsData = JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8'));
    console.log(`Local words.json root: ${wordsData.root}`);
  }

  // 2. Fetch root from contract
  try {
    // Try multiple RPCs to be safe
    const rpcs = [
      process.env.RPC_SEPOLIA,
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://rpc.ankr.com/eth_sepolia',
      'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY
    ].filter(url => url && url.startsWith('http'));

    console.log(`Using RPC: ${rpcs[0]}`);
    const provider = new ethers.JsonRpcProvider(rpcs[0]);
    const abi = ['function merkleRoot() view returns (bytes32)'];
    const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
    
    const contractRoot = await contract.merkleRoot();
    console.log(`Contract root:         ${contractRoot}`);

    // 3. Simple comparison
    const wordsData = fs.existsSync(WORDS_FILE) ? JSON.parse(fs.readFileSync(WORDS_FILE, 'utf8')) : null;
    if (wordsData && wordsData.root === contractRoot) {
      console.log('\n✅ SUCCESS: Merkle roots match!');
    } else if (wordsData) {
      console.log('\n❌ MISMATCH: Local root does not match contract root!');
      console.log('You need to redeploy the contract or regenerate words.json');
    }
  } catch (err) {
    console.error('❌ Error fetching from contract:', err.message);
  }
}

verify();
