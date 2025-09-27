// deploy/01-deploy-wordle.js
const { ethers } = require("hardhat");

async function main() {
  console.log("🔒 Deploying FIXED FHEVMWordleFHE on Sepolia!");
  
  const [deployer] = await ethers.getSigners();
  console.log("💪 Deploying with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  // ИСПОЛЬЗУЕМ ИСПРАВЛЕННЫЙ КОНТРАКТ! 🔥
  console.log("🔒 Compiling FIXED contract...");
  const FHEVMWordleFHE = await ethers.getContractFactory("FHEVMWordleFHE_Fixed");
  
  console.log("🚀 Deploying FIXED contract...");
  const contract = await FHEVMWordleFHE.deploy();
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  
  console.log("✅ FIXED FHEVMWordleFHE deployed to:", contractAddress);
  console.log("🔒 REAL FHE ENCRYPTION READY!");
  console.log("🧪 Test mode:", await contract.testMode());
  
  // ПЕРЕКЛЮЧАЕМ В PROD MODE
  console.log("🔄 Switching to PRODUCTION mode...");
  const tx = await contract.setTestMode(false);
  await tx.wait();
  
  console.log("✅ Production mode activated!");
  console.log("🔒 Now using REAL FHE operations!");
  
  console.log("\n🎉 FIXED FHE DEPLOYMENT COMPLETE!");
  console.log("📍 Contract Address:", contractAddress);
  console.log("🔒 Real FHE encryption: READY TO TEST!");
  console.log("🌐 Network: Sepolia");
  
  return contractAddress;
}

main()
  .then(() => {
    console.log("🔥 FIXED FHE WORDLE IS LIVE!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 DEPLOYMENT FAILED:", error);
    process.exit(1);
  });
