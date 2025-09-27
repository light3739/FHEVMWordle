const { expect } = require('chai');
const { ethers, network, fhevm } = require('hardhat'); // ← ДОБАВЛЯЕМ fhevm!

describe('FHEVMWordleFHE - Encrypted Wordle Tests', function () {
  let contract;
  let owner, player1, player2;
  let contractAddress;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    const FHEVMWordleFHE = await ethers.getContractFactory('FHEVMWordleFHE');
    contract = await FHEVMWordleFHE.deploy();
    await contract.waitForDeployment();

    contractAddress = await contract.getAddress();

    // БЕЗ initializeWordBank - пока не нужно
  });

  it('✅ Should deploy correctly', async function () {
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.wordBankSize()).to.equal(4);
    expect(await contract.testMode()).to.be.true;
  });

  it('✅ Should start encrypted game', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));

    await expect(contract.connect(player1).startGame(sessionHash)).to.emit(
      contract,
      'GameStarted'
    );

    const gameState = await contract.connect(player1).getGameState(sessionHash);
    expect(gameState.exists).to.be.true;
    expect(gameState.currentAttempt).to.equal(0);
  });

  it('✅ Should submit guess and win', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));
    await contract.connect(player1).startGame(sessionHash);

    const secretWord = await contract.connect(player1).getSecretWord();
    console.log(
      'Secret word:',
      secretWord.map(n => String.fromCharCode(Number(n) + 64)).join('')
    );

    const correctGuess = Array.from(secretWord).map(n => Number(n));

    await expect(contract.connect(player1).submitGuess(correctGuess))
      .to.emit(contract, 'GuessSubmitted')
      .and.to.emit(contract, 'GameCompleted');

    const stats = await contract.getPlayerStats(player1.address);
    expect(stats.gamesWon).to.equal(1);
    expect(stats.currentStreak).to.equal(1);
  });

  it('✅ Should handle wrong guess', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));
    await contract.connect(player1).startGame(sessionHash);

    const wrongGuess = [1, 2, 3, 4, 5]; // ABCDE
    await contract.connect(player1).submitGuess(wrongGuess);

    const gameState = await contract.connect(player1).getGameState(sessionHash);
    expect(gameState.currentAttempt).to.equal(1);
    expect(gameState.status).to.equal(1); // InProgress
  });

  it('✅ Should toggle test mode', async function () {
    expect(await contract.testMode()).to.be.true;

    await contract.setTestMode(false);
    expect(await contract.testMode()).to.be.false;

    await contract.setTestMode(true);
    expect(await contract.testMode()).to.be.true;
  });

  it('✅ Should enforce rate limiting', async function () {
    const sessionHash1 = ethers.keccak256(ethers.toUtf8Bytes('session1'));
    const sessionHash2 = ethers.keccak256(ethers.toUtf8Bytes('session2'));

    await contract.connect(player1).startGame(sessionHash1);

    await expect(
      contract.connect(player1).startGame(sessionHash2)
    ).to.be.revertedWith('Too frequent game starts');
  });
});
