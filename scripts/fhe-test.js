// scripts/fhe-test.js
const { ethers } = require("hardhat");
const WORD_LENGTH = 5;

async function main() {
  const net = await ethers.provider.getNetwork();
  console.log("🌐 Network:", net.name, Number(net.chainId));
  if (Number(net.chainId) !== 11155111) throw new Error("Run on Sepolia");  // защита [11155111]

  const contractAddress = process.env.CONTRACT;
  if (!contractAddress) throw new Error("Set CONTRACT env var with contract address");

  const [signer] = await ethers.getSigners();
  const c = await ethers.getContractAt("FHEVMWordleFHE_Fixed", contractAddress, signer);

  // Убедиться, что FHE (prod) включен
  const tm = await c.testMode();
  console.log("🧪 testMode:", tm);
  if (tm) {
    const tx0 = await c.setTestMode(false);
    await tx0.wait();
    console.log("🔄 Switched to !testMode");
  }

  // 1) startGame
  const sessionHash = ethers.keccak256(ethers.toUtf8Bytes("session-1"));
  let tx = await c.startGame(sessionHash);
  await tx.wait();
  console.log("✅ startGame sent");

  // 2) submitGuess (пример HELLO -> [8,5,12,12,15])
  const guess = [8, 5, 12, 12, 15];
  tx = await c.submitGuess(guess);
  await tx.wait();
  console.log("✅ submitGuess sent");

  // 3) запрос дешифровки результатов
  tx = await c.requestDecryptResults();
  await tx.wait();
  console.log("🔐 requestDecryptResults sent");

  // 4) ждать GuessEvaluated от оракула
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting GuessEvaluated")), 180000);
    c.on("GuessEvaluated", (player, attempt, results) => {
      console.log("🎯 GuessEvaluated:", {
        player,
        attempt: Number(attempt),
        results: results.map((x) => Number(x)),
      });
      clearTimeout(timeout);
      resolve();
    });
  });

  console.log("🎉 FHE round completed");
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
