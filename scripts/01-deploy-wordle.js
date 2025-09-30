// deploy/01-deploy-wordle.js
// Usage:
//   npx hardhat run deploy/01-deploy-wordle.js --network sepolia

const hre = require("hardhat");
const { ethers } = hre;
const { readFileSync } = require("fs");

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log("🌐 Active network:", net.name, Number(net.chainId));

  // читаем Merkle-артефакты
  const root = readFileSync("dist/merkle-root.txt", "utf8").trim();
  const { leaves } = JSON.parse(readFileSync("dist/words.json", "utf8"));
  console.log("🌳 merkleRoot:", root);
  console.log("🍃 leaves:", leaves);

  const [deployer] = await ethers.getSigners();
  console.log("💪 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  console.log("🚀 Deploying FHEVMWordleMerkle...");
  const F = await ethers.getContractFactory("FHEVMWordleMerkle");   // <-- имя контракта из файла
  const c = await F.deploy(root, leaves);                            // <-- конструктор (root, leaves)
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log("✅ Deployed at:", addr);

  console.log("\n🎉 Deployment complete");
  console.log("📍 Contract Address:", addr);
  console.log("🌐 Network:", net.name, Number(net.chainId));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
