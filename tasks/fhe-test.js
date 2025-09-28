// tasks/fhe-test.js
const { task } = require("hardhat/config");

task("fhe:test", "Run FHE test flow on Sepolia")
  .addParam("address", "Contract address")
  .setAction(async ({ address }, hre) => {
    const { ethers } = hre;
    const net = await ethers.provider.getNetwork();
    console.log("🌐 Network:", net.name, Number(net.chainId));
    if (Number(net.chainId) !== 11155111) throw new Error("Run on Sepolia");

    const [signer] = await ethers.getSigners();
    const c = await ethers.getContractAt("FHEVMWordleFHE_Fixed", address, signer);

    const tm = await c.testMode();
    console.log("🧪 testMode:", tm);
    if (tm) {
      const tx0 = await c.setTestMode(false);
      await tx0.wait();
      console.log("🔄 Switched to !testMode");
    }

    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes("session-1"));
    let tx = await c.startGame(sessionHash);
    await tx.wait();
    console.log("✅ startGame sent");

    const guess = [8, 5, 12, 12, 15];
    tx = await c.submitGuess(guess);
    await tx.wait();
    console.log("✅ submitGuess sent");

    tx = await c.requestDecryptResults();
    await tx.wait();
    console.log("🔐 requestDecryptResults sent");

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
  });

module.exports = {};
