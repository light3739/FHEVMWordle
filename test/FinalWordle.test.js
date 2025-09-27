const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FHEVMWordleFinal - Full Production Tests', function () {
  let contract;
  let owner, player1, player2;

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();

    // МЕНЯЕМ НА НОВЫЙ КОНТРАКТ
    const FHEVMWordleFinal = await ethers.getContractFactory('FHEVMWordleFinal');
    contract = await FHEVMWordleFinal.deploy();
    await contract.waitForDeployment();
  });

  it('✅ Should deploy correctly', async function () {
    expect(await contract.owner()).to.equal(owner.address);
    expect(await contract.wordBankSize()).to.equal(10); // ИЗМЕНИЛОСЬ НА 10!

    const debug = await contract.debugWordBank();
    expect(debug[0]).to.equal(10); // size
    expect(debug[1]).to.equal(10); // length
    expect(debug[2]).to.be.true; // match
  });

  it('✅ Should start game', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));

    await expect(contract.connect(player1).startGame(sessionHash)).to.emit(
      contract,
      'GameStarted'
    );

    const gameState = await contract.connect(player1).getGameState(sessionHash);
    expect(gameState.exists).to.be.true;
    expect(gameState.currentAttempt).to.equal(0);
  });

  it('✅ Should submit guess and evaluate', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));
    await contract.connect(player1).startGame(sessionHash);

    const secretWord = await contract.connect(player1).getSecretWord();
    console.log('Secret word:', secretWord.map(n => String.fromCharCode(Number(n) + 64)).join(''));

    // ИСПОЛЬЗУЕМ РЕАЛЬНОЕ СЕКРЕТНОЕ СЛОВО ИЗ ИГРЫ
    const correctGuess = Array.from(secretWord).map(n => Number(n));
    
    await expect(contract.connect(player1).submitGuess(correctGuess))
      .to.emit(contract, 'GuessSubmitted')
      .and.to.emit(contract, 'GameCompleted');

    // ПРОВЕРЯЕМ СТАТИСТИКУ
    const stats = await contract.getPlayerStats(player1.address);
    expect(stats.gamesWon).to.equal(1);
    expect(stats.currentStreak).to.equal(1);
  });


  it('✅ Should handle wrong guess', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('test-session'));
    await contract.connect(player1).startGame(sessionHash);

    // Submit wrong guess
    const wrongGuess = [1, 2, 3, 4, 5]; // ABCDE
    await contract.connect(player1).submitGuess(wrongGuess);

    const gameState = await contract.connect(player1).getGameState(sessionHash);
    expect(gameState.currentAttempt).to.equal(1);
    expect(gameState.status).to.equal(1); // InProgress
  });

  it('✅ Should handle admin functions', async function () {
    await contract.pauseGame('Test pause');
    expect(await contract.isPaused()).to.be.true;

    await contract.unpauseGame();
    expect(await contract.isPaused()).to.be.false;

    const stats = await contract.getContractStats();
    expect(stats.totalWords).to.equal(10); // ИЗМЕНИЛОСЬ НА 10!
  });

  it('✅ Should enforce rate limiting', async function () {
    const sessionHash1 = ethers.keccak256(ethers.toUtf8Bytes('session1'));
    const sessionHash2 = ethers.keccak256(ethers.toUtf8Bytes('session2'));

    await contract.connect(player1).startGame(sessionHash1);

    // Should fail due to rate limiting
    await expect(
      contract.connect(player1).startGame(sessionHash2)
    ).to.be.revertedWith('Too frequent game starts');
  });

  it('✅ Should recover game', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('recovery-test'));

    // Start game
    await contract.connect(player1).startGame(sessionHash);

    // Submit one guess (НЕ HELLO, чтобы игра не завершилась)
    const guess = [1, 2, 3, 4, 5]; // ABCDE
    await contract.connect(player1).submitGuess(guess);

    // ДОБАВЛЯЕМ ЗАДЕРЖКУ (симуляция времени)
    await network.provider.send("evm_increaseTime", [31]); // 31 секунда
    await network.provider.send("evm_mine");

    // "Recover" game with same session hash
    await expect(contract.connect(player1).startGame(sessionHash))
      .to.emit(contract, 'GameStarted');

    const gameState = await contract.connect(player1).getGameState(sessionHash);
    expect(gameState.currentAttempt).to.equal(1); // Still has the guess
  });


  // НОВЫЙ ТЕСТ ДЛЯ DEBUG
  it('✅ Should debug game status', async function () {
    const sessionHash = ethers.keccak256(ethers.toUtf8Bytes('debug-test'));
    
    // Before game
    let [status, hasActive, gameId] = await contract.debugGameStatus(player1.address);
    expect(status).to.equal(0); // NotStarted
    expect(hasActive).to.be.false;
    
    // After starting game
    await contract.connect(player1).startGame(sessionHash);
    [status, hasActive, gameId] = await contract.debugGameStatus(player1.address);
    expect(status).to.equal(1); // InProgress
    expect(hasActive).to.be.true;
    expect(gameId).to.not.equal(0);
  });
});
