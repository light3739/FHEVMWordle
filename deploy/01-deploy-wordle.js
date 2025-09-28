// deploy/01-deploy-wordle.js
const { ethers } = require('hardhat');

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log('🌐 Active network:', net.name, Number(net.chainId));
  if (Number(net.chainId) !== 11155111) {
    throw new Error('Not on Sepolia (chainId must be 11155111)');
  }

  console.log('🔒 Deploying FIXED FHEVMWordleFHE on Sepolia!');
  const [deployer] = await ethers.getSigners();
  console.log('💪 Deploying with account:', deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('💰 Account balance:', ethers.formatEther(balance), 'ETH');

  const FHEVMWordleFHE = await ethers.getContractFactory(
    'FHEVMWordleFHE_Fixed'
  );
  console.log('🚀 Deploying FIXED contract...');
  const contract = await FHEVMWordleFHE.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log('✅ FIXED FHEVMWordleFHE deployed to:', contractAddress);

  // Включаем «прод» FHE-режим
  const testMode = await contract.testMode();
  console.log('🧪 Test mode (before):', testMode);
  if (testMode) {
    console.log('🔄 Switching to PRODUCTION mode...');
    const tx = await contract.setTestMode(false);
    await tx.wait();
  }
  console.log('🧪 Test mode (after):', await contract.testMode());
  console.log('🔒 Now using REAL FHE operations!');

  console.log('\n🎉 FIXED FHE DEPLOYMENT COMPLETE!');
  console.log('📍 Contract Address:', contractAddress);
  console.log('🌐 Network:', net.name, Number(net.chainId));
  return contractAddress;
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
