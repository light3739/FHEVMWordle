/* tasks/fhe-play.js */
const { task } = require('hardhat/config');
const { ethers } = require('ethers');

// Utils
function charToNum(c) {
  const code = c.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) throw new Error(`Invalid char: ${c}`);
  return code - 64;
} // A=1..Z=26
function wordToNums(w) {
  if (w.length !== 5) throw new Error(`Word must be 5 letters: ${w}`);
  return Array.from(w).map(charToNum);
}
function paintRow(word, results) {
  const cells = [];
  for (let i = 0; i < 5; i++) {
    const s = Number(results[i]);
    const ch = word[i].toUpperCase();
    if (s === 3) cells.push(`🟩${ch}`);
    else if (s === 2) cells.push(`🟨${ch}`);
    else cells.push(`⬛${ch}`);
  }
  return cells.join(' ');
}
function allGreen(results) {
  return results.every(x => Number(x) === 3);
}

// Safe EIP-1559 fees
async function getFeeOverrides(
  provider,
  { prioGwei = 3n, minBaseGwei = 10n, maxMultiplier = 150n } = {}
) {
  const fd = await provider.getFeeData();
  const base =
    fd.maxFeePerGas ?? ethers.parseUnits(minBaseGwei.toString(), 'gwei');
  const prio = fd.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const bumpPrio = prio + ethers.parseUnits(prioGwei.toString(), 'gwei');
  const candidate = base + bumpPrio;
  const minMax = (base * maxMultiplier) / 100n;
  const finalMax = candidate > minMax ? candidate : minMax;
  return { maxPriorityFeePerGas: bumpPrio, maxFeePerGas: finalMax };
}

task('fhe:play', 'Play Wordle over FHE on Sepolia (robust)')
  .addParam('address', 'Contract address')
  .addParam('words', 'Comma-separated 5-letter words, e.g. HELLO,WORLD,TABLE')
  .setAction(async ({ address, words }, hre) => {
    // Provider v6 pinned to Sepolia
    const req = new ethers.FetchRequest(hre.network.config.url);
    req.timeout = 300_000;
    const provider = new ethers.JsonRpcProvider(req, 11155111);
    const net = await provider.getNetwork();
    console.log('🌐 Network:', net.name, Number(net.chainId));
    if (Number(net.chainId) !== 11155111) throw new Error('Run on Sepolia');

    // Signer
    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error('Set PRIVATE_KEY');
    const wallet = new ethers.Wallet(pk, provider);

    // Contract
    const art = await hre.artifacts.readArtifact('FHEVMWordleFHE_Fixed');
    const c = new ethers.Contract(address, art.abi, wallet);
    const me = await wallet.getAddress();

    // Ensure production FHE mode
    if (await c.testMode()) {
      const fees0 = await getFeeOverrides(provider);
      const tx0 = await c.setTestMode(false, fees0);
      await tx0.wait();
    }

    // Continue or start new game
    const wallStart = Date.now();
    let g = await c.games(me);
    if (Number(g.status) === 0 || Number(g.status) > 1) {
      const sessionHash = ethers.keccak256(
        ethers.toUtf8Bytes(`session-${wallStart}`)
      );
      const feesS = await getFeeOverrides(provider);
      const txS = await c.startGame(sessionHash, feesS);
      await txS.wait();
      console.log('🎮 Game started');
      g = await c.games(me);
    } else {
      console.log(
        `🔄 Continuing game: attempt ${Number(
          g.currentAttempt
        )}/6, pending ${g.pendingRequestId.toString()}`
      );
    }

    // Helper: wait event GuessEvaluated for attempt idx
    async function waitGuessEvaluated(idx) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          c.removeAllListeners('GuessEvaluated');
          reject(new Error('Timeout waiting GuessEvaluated'));
        }, 180_000);
        const handler = (player, attempt, results) => {
          if (String(player).toLowerCase() !== me.toLowerCase()) return;
          if (Number(attempt) !== idx) return;
          c.removeListener('GuessEvaluated', handler);
          clearTimeout(timeout);
          resolve(results.map(x => Number(x)));
        };
        c.on('GuessEvaluated', handler);
      });
    }

    const guesses = words.split(',').map(w => w.trim().toUpperCase());

    // Main loop
    for (;;) {
      g = await c.games(me);
      if (Number(g.status) !== 1) {
        // not InProgress
        console.log(
          `✅ Done. Status: ${Number(
            g.status
          )} (2=Won,3=Lost), attempt: ${Number(
            g.currentAttempt
          )}, pending: ${g.pendingRequestId.toString()}`
        );
        break;
      }
      const i = Number(g.currentAttempt);
      if (i >= 6 || i >= guesses.length) {
        console.log(
          `🛑 No more guesses to play (i=${i}, provided=${guesses.length})`
        );
        break;
      }

      // Enforce no pending decrypt
      if (Number(g.pendingRequestId) !== 0) {
        console.log(
          `⏳ Pending decrypt ${g.pendingRequestId.toString()} still in progress; waiting 5s…`
        );
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      const word = guesses[i];
      const arr = wordToNums(word);

      // Preflight via callStatic to detect require-fail early
      try {
        await c.submitGuess.staticCall(arr); // no state change, checks revertability
      } catch (e) {
        console.error(
          `❌ submitGuess would revert at attempt ${i + 1}:`,
          e?.shortMessage || e?.message || e
        );
        // Minor backoff and re-check state; if still blocked, stop
        await new Promise(r => setTimeout(r, 3000));
        const g2 = await c.games(me);
        console.log(
          `📊 State — status: ${Number(g2.status)}, attempt: ${Number(
            g2.currentAttempt
          )}, pending: ${g2.pendingRequestId.toString()}`
        );
        if (
          Number(g2.status) !== 1 ||
          Number(g2.currentAttempt) !== i ||
          Number(g2.pendingRequestId) !== 0
        )
          continue;
        // as last resort we can try sending with explicit gasLimit, but if it truly reverts it will still fail
      }

      // Submit with safe fees and optional gasLimit fallback
      const feesG = await getFeeOverrides(provider);
      let txG;
      try {
        txG = await c.submitGuess(arr, { ...feesG }); // let node estimate gas
        await txG.wait();
      } catch (e) {
        console.error(
          `⚠️ submitGuess estimate/send error at attempt ${i + 1}:`,
          e?.shortMessage || e?.message || e
        );
        // Try with conservative gasLimit to bypass estimateGas failure paths
        try {
          txG = await c.submitGuess(arr, { ...feesG, gasLimit: 2_000_000 });
          await txG.wait();
        } catch (e2) {
          console.error(
            `❌ submitGuess hard-failed at attempt ${i + 1}:`,
            e2?.shortMessage || e2?.message || e2
          );
          break;
        }
      }

      // Re-read state and ensure no pending before requesting decrypt
      let gBefore = await c.games(me);
      if (Number(gBefore.pendingRequestId) !== 0) {
        console.log(
          `⏳ Pending became ${gBefore.pendingRequestId.toString()} after submit; waiting…`
        );
        await new Promise(r => setTimeout(r, 3000));
        gBefore = await c.games(me);
      }
      if (Number(gBefore.pendingRequestId) !== 0) {
        // If contract auto-triggers request inside submit (unlikely), just wait for event
      } else {
        const t0 = Date.now();
        const feesR = await getFeeOverrides(provider);
        let txR;
        try {
          txR = await c.requestDecryptResults({ ...feesR });
          await txR.wait();
        } catch (e) {
          console.error(
            `⚠️ requestDecryptResults error:`,
            e?.shortMessage || e?.message || e
          );
          // Retry once with gasLimit if estimateGas failed
          try {
            txR = await c.requestDecryptResults({
              ...feesR,
              gasLimit: 800_000,
            });
            await txR.wait();
          } catch (e2) {
            console.error(
              `❌ requestDecryptResults hard-failed:`,
              e2?.shortMessage || e2?.message || e2
            );
            break;
          }
        }

        const reqId = await c.latestRequestId();
        let res;
        try {
          res = await waitGuessEvaluated(i);
        } catch (e) {
          console.error('⛔ waitGuessEvaluated timeout:', e?.message || e);
          // passive retry once
          await new Promise(r => setTimeout(r, 5000));
          res = await waitGuessEvaluated(i);
        }
        const dt = Date.now() - t0;
        console.log(
          `📝 Attempt ${i + 1}: ${paintRow(
            word,
            res
          )}  ⏱ decrypt ${dt} ms  (requestId ${reqId})`
        );
        if (allGreen(res)) {
          const total = Date.now() - wallStart;
          console.log(`🏆 Win! ⏱ total ${total} ms`);
          break;
        }
      }
    }
  });

module.exports = {};
