/* tasks/fhe-play.js */
const { task } = require('hardhat/config');
const { ethers } = require('ethers');

// Utils
function charToNum(c) {
  const code = c.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) throw new Error(`Invalid char: ${c}`);
  return code - 64;
}
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

// Minimal EIP-1559 boost
async function getFeeOverrides(
  provider,
  { extraPrioGwei = 1n, maxFeeHeadroomPct = 10n } = {}
) {
  const fd = await provider.getFeeData();
  const prio = fd.maxPriorityFeePerGas ?? ethers.parseUnits('1', 'gwei');
  const baseMax = fd.maxFeePerGas ?? prio * 2n;
  const bumpPrio = prio + ethers.parseUnits(extraPrioGwei.toString(), 'gwei');
  const headroom = (baseMax * (100n + maxFeeHeadroomPct)) / 100n;
  const finalMax =
    headroom > bumpPrio ? headroom : bumpPrio + ethers.parseUnits('1', 'gwei');
  return { maxPriorityFeePerGas: bumpPrio, maxFeePerGas: finalMax };
}

// Анализ событий в транзакции
async function analyzeTransaction(provider, txHash, contract) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    console.log(
      `📋 Receipt status: ${receipt.status}, gasUsed: ${receipt.gasUsed}`
    );
    console.log(`📋 Logs count: ${receipt.logs.length}`);

    // Декодируем события
    for (const log of receipt.logs) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed) {
          console.log(`📝 Event: ${parsed.name}`, parsed.args.map(String));
        }
      } catch (e) {
        // Не наш контракт или неизвестное событие
      }
    }

    // Пробуем replay для получения revert reason
    if (receipt.status === 0n) {
      try {
        const tx = await provider.getTransaction(txHash);
        await provider.call(
          {
            to: tx.to,
            from: tx.from,
            data: tx.data,
            gasLimit: tx.gasLimit,
            value: tx.value || 0,
          },
          receipt.blockNumber
        );
      } catch (error) {
        if (error.reason) {
          console.log(`📋 Revert reason: ${error.reason}`);
        } else if (error.data && error.data.startsWith('0x08c379a0')) {
          try {
            const reason = ethers.AbiCoder.defaultAbiCoder().decode(
              ['string'],
              '0x' + error.data.slice(10)
            );
            console.log(`📋 Revert reason: ${reason[0]}`);
          } catch (e) {
            console.log(`📋 Raw revert data: ${error.data}`);
          }
        } else {
          console.log(
            `📋 Unknown revert:`,
            error.shortMessage || error.message
          );
        }
      }
    }
  } catch (e) {
    console.log(`📋 Analysis failed:`, e.message);
  }
}

// Толерантная отправка
async function sendFunctionTolerant({
  wallet,
  contract,
  func,
  args = [],
  provider,
  gasLimit,
}) {
  const fees = await getFeeOverrides(provider);

  let gas;
  try {
    gas = await contract[func].estimateGas(...args, { ...fees });
  } catch (e) {
    console.log(`⚠️ Gas estimation failed for ${func}:`, e?.shortMessage);
    gas = gasLimit ?? 2_000_000n;
  }
  const finalGas =
    gasLimit ?? (typeof gas === 'bigint' ? (gas * 130n) / 100n : 2_200_000n);

  try {
    const tx = await contract[func](...args, { ...fees, gasLimit: finalGas });
    console.log(`📤 Sent ${func} tx:`, tx.hash);

    const r = await tx.wait();
    console.log(
      `📥 ${func} mined, block: ${r.blockNumber}, gasUsed: ${r.gasUsed}`
    );

    // Анализируем транзакцию независимо от статуса
    await analyzeTransaction(provider, r.hash, contract);

    if (r.status !== 1n) {
      console.log(`⚠️ ${func} reverted but may have partial effect`);
      return { success: false, receipt: r };
    }

    return { success: true, receipt: r };
  } catch (e) {
    console.error(`❌ ${func} failed:`, e?.shortMessage || e?.message);
    throw e;
  }
}

task('fhe:play', 'Play Wordle with fault tolerance and auto-restart')
  .addParam('address', 'Contract address')
  .addParam('words', 'Comma-separated 5-letter words, e.g. HELLO,WORLD,TABLE')
  .setAction(async ({ address, words }, hre) => {
    const req = new ethers.FetchRequest(hre.network.config.url);
    req.timeout = 300_000;
    const provider = new ethers.JsonRpcProvider(req, 11155111);
    const net = await provider.getNetwork();
    console.log('🌐 Network:', net.name, Number(net.chainId));

    const pk = process.env.PRIVATE_KEY;
    if (!pk) throw new Error('Set PRIVATE_KEY');
    const wallet = new ethers.Wallet(pk, provider);
    const me = await wallet.getAddress();
    console.log('👤 Player:', me);

    const art = await hre.artifacts.readArtifact('FHEVMWordleFHE_Fixed');
    const c = new ethers.Contract(address, art.abi, wallet);

    const wallStart = Date.now();
    let g = await c.games(me);

    console.log(
      `📊 Game state: status=${Number(g.status)}, attempt=${Number(
        g.currentAttempt
      )}, pending=${g.pendingRequestId.toString()}`
    );

    // 🎮 АВТОМАТИЧЕСКИЙ СТАРТ НОВОЙ ИГРЫ
    const needNewGame = Number(g.status) === 0 || Number(g.status) > 1; // NotStarted, Won, Lost

    if (needNewGame) {
      console.log(`🎮 Starting new game (current status: ${Number(g.status)})`);
      const sessionHash = ethers.keccak256(
        ethers.toUtf8Bytes(`session-${wallStart}-${Math.random()}`)
      );

      try {
        const startResult = await sendFunctionTolerant({
          wallet,
          contract: c,
          func: 'startGame',
          args: [sessionHash],
          provider,
          gasLimit: 1_000_000n,
        });

        if (startResult.success) {
          console.log('✅ New game started successfully');
        } else {
          console.log('⚠️ startGame reverted but may have worked');
        }

        // Обновляем состояние игры после старта
        g = await c.games(me);
        console.log(
          `📊 After start: status=${Number(g.status)}, attempt=${Number(
            g.currentAttempt
          )}`
        );
      } catch (e) {
        console.error('❌ Failed to start new game:', e.message);
        // Пробуем продолжить с текущим состоянием
      }
    } else {
      console.log(`🔄 Continuing existing game`);
    }

    // Wait GuessEvaluated
    async function waitGuessEvaluated(idx) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          c.removeAllListeners('GuessEvaluated');
          reject(new Error('Timeout waiting GuessEvaluated'));
        }, 180_000);
        const handler = (player, attempt, results) => {
          console.log(
            `📡 GuessEvaluated: player=${player}, attempt=${attempt}, results=[${results
              .map(Number)
              .join(',')}]`
          );
          if (String(player).toLowerCase() !== me.toLowerCase()) return;
          if (Number(attempt) !== idx) return;
          c.removeListener('GuessEvaluated', handler);
          clearTimeout(timeout);
          resolve(results.map(Number));
        };
        c.on('GuessEvaluated', handler);
      });
    }

    const guesses = words.split(',').map(w => w.trim().toUpperCase());
    console.log('📝 Words to guess:', guesses.join(', '));

    // Main game loop с толерантностью к ревёртам
    let attemptIndex = Number(g.currentAttempt);

    while (attemptIndex < Math.min(6, guesses.length)) {
      // Обновляем состояние игры
      g = await c.games(me);
      console.log(
        `🔄 Loop: attempt=${Number(g.currentAttempt)}, status=${Number(
          g.status
        )}, pending=${g.pendingRequestId.toString()}`
      );

      if (Number(g.status) !== 1) {
        const statusMsg =
          Number(g.status) === 2
            ? 'Won'
            : Number(g.status) === 3
            ? 'Lost'
            : 'NotStarted';
        console.log(
          `✅ Game ended with status: ${Number(g.status)} (${statusMsg})`
        );

        // 🎮 АВТОМАТИЧЕСКИЙ РЕСТАРТ ПРИ ЗАВЕРШЕНИИ ИГРЫ
        if (Number(g.status) > 1) {
          // Won или Lost
          console.log(`🔄 Auto-restarting new game...`);
          const newSessionHash = ethers.keccak256(
            ethers.toUtf8Bytes(`restart-${Date.now()}-${Math.random()}`)
          );

          try {
            await sendFunctionTolerant({
              wallet,
              contract: c,
              func: 'startGame',
              args: [newSessionHash],
              provider,
              gasLimit: 1_000_000n,
            });

            console.log('✅ New game auto-started');
            g = await c.games(me);
            attemptIndex = Number(g.currentAttempt); // Reset attempt index
            continue; // Продолжаем с новой игрой
          } catch (e) {
            console.error('❌ Auto-restart failed:', e.message);
            break;
          }
        } else {
          break; // NotStarted - выходим
        }
      }

      if (Number(g.pendingRequestId) !== 0) {
        console.log(
          `⏳ Pending decrypt ${g.pendingRequestId.toString()}, waiting...`
        );
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      // Синхронизируем наш индекс с контрактом
      const contractAttempt = Number(g.currentAttempt);
      if (attemptIndex < contractAttempt) {
        console.log(
          `🔁 Syncing: our=${attemptIndex}, contract=${contractAttempt}`
        );
        attemptIndex = contractAttempt;
      }

      if (attemptIndex >= guesses.length) {
        console.log(`🛑 No more words for attempt ${attemptIndex}`);
        break;
      }

      const word = guesses[attemptIndex];
      const arr = wordToNums(word);
      console.log(
        `🎯 Attempt ${attemptIndex + 1}: ${word} -> [${arr.join(',')}]`
      );

      // submitGuess с толерантностью
      const submitResult = await sendFunctionTolerant({
        wallet,
        contract: c,
        func: 'submitGuess',
        args: [arr],
        provider,
        gasLimit: 2_200_000n,
      });

      // Проверяем состояние после submit
      const gAfterSubmit = await c.games(me);
      console.log(
        `📊 After submit: attempt=${Number(
          gAfterSubmit.currentAttempt
        )}, pending=${gAfterSubmit.pendingRequestId.toString()}, status=${Number(
          gAfterSubmit.status
        )}`
      );

      // Если attempt увеличился, значит submit сработал
      if (Number(gAfterSubmit.currentAttempt) > attemptIndex) {
        console.log(`✅ Submit had effect despite revert`);
        attemptIndex = Number(gAfterSubmit.currentAttempt);
      } else if (!submitResult.success) {
        console.log(`❌ Submit failed and no state change`);
        break;
      }

      // requestDecryptResults если нет pending
      if (Number(gAfterSubmit.pendingRequestId) === 0) {
        console.log('🔐 Requesting decryption...');

        const decryptResult = await sendFunctionTolerant({
          wallet,
          contract: c,
          func: 'requestDecryptResults',
          args: [],
          provider,
          gasLimit: 800_000n,
        });

        if (
          decryptResult.success ||
          Number((await c.games(me)).pendingRequestId) !== 0
        ) {
          const reqId = await c.latestRequestId();
          console.log(`🔍 Waiting for decrypt of request ${reqId}...`);

          try {
            const t0 = Date.now();
            const res = await waitGuessEvaluated(attemptIndex - 1);
            const dt = Date.now() - t0;

            console.log(
              `📝 Result ${attemptIndex}: ${paintRow(word, res)}  ⏱ ${dt} ms`
            );

            if (allGreen(res)) {
              const total = Date.now() - wallStart;
              console.log(`🏆 Win! ⏱ total ${total} ms`);
              // Не break - позволяем циклу автоматически стартовать новую игру
            }
          } catch (e) {
            console.log('⏰ Decrypt timeout:', e.message);
          }
        } else {
          console.log('❌ Decrypt request failed');
        }
      } else {
        console.log(
          `⏳ Already pending: ${gAfterSubmit.pendingRequestId.toString()}`
        );
        await new Promise(r => setTimeout(r, 3000));
      }
    }

    const finalGame = await c.games(me);
    console.log(
      `🏁 Final: status=${Number(finalGame.status)}, attempt=${Number(
        finalGame.currentAttempt
      )}`
    );
  });

module.exports = {};
