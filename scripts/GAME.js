#!/usr/bin/env node
/* fhe-wordle.js — unified Node script (mechanics improved, gas untouched) */
const { ethers } = require('ethers');
const readline = require('readline');
require('dotenv').config();

/* ===== Config & ABI (без ручных газ-настроек) ===== */
const DEFAULT_RPC =
  process.env.RPC_URL ||
  (process.env.INFURA_API_KEY
    ? `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    : null);

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS ||
  (process.argv.includes('--address')
    ? process.argv[process.argv.indexOf('--address') + 1]
    : null);

/* Упрощённый ABI под используемые методы/события */
const GAME_ABI = [
  'function startGame(bytes32 sessionHash)',
  'function submitGuess(uint8[5] guess)',
  'function requestDecryptResults()',
  'function getGameState(bytes32 sessionHash) view returns (bool exists, bool canRecover, uint256 gameId, uint8 status, uint8 currentAttempt, uint256 startTime, uint256 timeRemaining, bool hasExpired)',
  'function getLastGuessResults() view returns (uint8[5])',
  'event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[5] results)',
];

/* ===== IO ===== */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
function prompt(q) {
  return new Promise(resolve => rl.question(q, ans => resolve(ans.trim())));
}

/* ===== Helpers ===== */
function charToNum(c) {
  const code = c.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) throw new Error(`Invalid char: ${c}`);
  return code - 64;
}
function wordToNums(w) {
  if (!/^[a-zA-Z]{5}$/.test(w)) throw new Error(`Word must be 5 letters: ${w}`);
  return Array.from(w.toUpperCase()).map(charToNum);
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
function generateSessionHash(address) {
  return ethers.keccak256(
    ethers.toUtf8Bytes(`${address}-${Date.now()}-${Math.random()}`)
  );
}

/* ===== Ожидание события с поллингом (через provider) ===== */
async function waitGuessEvaluatedPoll({
  contract,
  provider,
  player,
  attemptIndex,
  fromBlock,
  timeoutMs = 180000,
  pollMs = 1500,
}) {
  const filter = contract.filters.GuessEvaluated(player);
  const deadline = Date.now() + timeoutMs;
  let start = fromBlock ?? 0;

  while (Date.now() < deadline) {
    const latest = await provider.getBlockNumber(); // используем провайдер v6
    const from = Math.max(start, latest - 5); // узкое окно на несколько блоков
    const events = await contract.queryFilter(filter, from, latest);
    if (events.length > 0) {
      const last = events[events.length - 1];
      const evAttempt = Number(last.args.attemptNumber);
      if (evAttempt === attemptIndex) {
        return last.args.results.map(Number);
      }
    }
    await new Promise(r => setTimeout(r, pollMs));
    start = latest + 1;
  }
  throw new Error('Timeout waiting GuessEvaluated');
}

/* ===== Main ===== */
async function main() {
  console.log(
    '\n🎮 FHEVM Wordle — unified Node (gas untouched)\n==============================================\n'
  );

  if (!DEFAULT_RPC) {
    console.log('❌ Provide RPC_URL or INFURA_API_KEY in .env');
    process.exit(1);
  }
  if (!process.env.PRIVATE_KEY) {
    console.log('❌ Provide PRIVATE_KEY in .env');
    process.exit(1);
  }
  if (!CONTRACT_ADDRESS) {
    console.log(
      '❌ Provide contract address via --address or CONTRACT_ADDRESS'
    );
    process.exit(1);
  }

  const req = new ethers.FetchRequest(DEFAULT_RPC);
  req.timeout = 300_000;
  const provider = new ethers.JsonRpcProvider(req);

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const me = await wallet.getAddress();
  const net = await provider.getNetwork();
  console.log('🌐 Network:', net.name, Number(net.chainId));
  console.log('👤 Player:', me);
  const bal = await provider.getBalance(me);
  console.log('💰 Balance:', ethers.formatEther(bal), 'ETH');

  const contract = new ethers.Contract(CONTRACT_ADDRESS, GAME_ABI, wallet);

  // CLI words or interactive
  let wordsArg = null;
  if (process.argv.includes('--words')) {
    wordsArg = process.argv[process.argv.indexOf('--words') + 1];
  }
  let words = [];
  if (wordsArg) words = wordsArg.split(',').map(w => w.trim().toUpperCase());

  // New session
  const sessionHash = generateSessionHash(me);
  console.log('🎮 Starting game with sessionHash:', sessionHash);

  const startTx = await contract.startGame(sessionHash);
  console.log('📤 startGame tx:', startTx.hash);
  const startRc = await startTx.wait();
  console.log('📥 startGame mined in block:', startRc.blockNumber);

  let attemptIndex = 0;
  let win = false;
  let fromBlock = startRc.blockNumber;

  while (attemptIndex < 6) {
    let word;
    if (attemptIndex < words.length) {
      word = words[attemptIndex];
    } else {
      word = await prompt(
        `🎯 Attempt ${attemptIndex + 1}/6 — Enter 5-letter word (or quit): `
      );
      if (word.toLowerCase() === 'quit') break;
      if (!/^[a-zA-Z]{5}$/.test(word)) {
        console.log('❌ Enter exactly 5 English letters');
        continue;
      }
      word = word.toUpperCase();
    }

    const arr = wordToNums(word);
    console.log(`⏳ submitGuess: ${word} -> [${arr.join(',')}]`);
    const guessTx = await contract.submitGuess(arr);
    console.log('📤 submitGuess tx:', guessTx.hash);
    const guessRc = await guessTx.wait();
    console.log('📥 submitGuess mined, block:', guessRc.blockNumber);

    console.log('🔐 Requesting decryption...');
    const decTx = await contract.requestDecryptResults();
    console.log('📤 requestDecryptResults tx:', decTx.hash);
    const decRc = await decTx.wait();
    console.log('📥 requestDecryptResults mined, block:', decRc.blockNumber);

    // Wait event for this attempt
    try {
      const res = await waitGuessEvaluatedPoll({
        contract,
        provider, // ВАЖНО: передаём провайдер
        player: me,
        attemptIndex,
        fromBlock,
      });
      console.log(`📝 Result ${attemptIndex + 1}: ${paintRow(word, res)}`);
      fromBlock = await provider.getBlockNumber();
      if (allGreen(res)) {
        console.log('🏆 Win!');
        win = true;
        break;
      }
    } catch (e) {
      console.log('⏰ Decrypt timeout or no event received:', e.message);
      // Не прерываем игру сразу, можно попробовать ещё одно слово
    }

    attemptIndex++;
  }

  console.log(
    `🏁 Finished. Win=${win}, attempts=${attemptIndex + (win ? 1 : 0)}`
  );
  rl.close();
}

if (require.main === module) {
  main().catch(e => {
    console.error('💥 Fatal:', e?.message || e);
    rl.close();
    process.exit(1);
  });
}
module.exports = {};
