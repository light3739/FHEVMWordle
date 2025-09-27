// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";

contract FHEVMWordleFHE {
    using TFHE for euint8;
    
    uint8 public constant WORD_LENGTH = 5;
    uint8 public constant MAX_ATTEMPTS = 6;
    uint256 public constant GAME_TIMEOUT = 24 hours;
    uint256 public constant MIN_GAME_INTERVAL = 30 seconds;
    
    enum GameStatus { NotStarted, InProgress, Won, Lost, Expired, Abandoned }
    
    struct GameData {
        uint256 gameId;
        address player;
        uint8 currentAttempt;
        GameStatus status;
        uint256 startTime;
        uint256 endTime;
        bytes32 sessionHash;
        uint256 wordIndex;
        bool canRecover;
    }
    
    struct PlayerStats {
        uint256 totalGames;
        uint256 gamesWon;
        uint256 currentStreak;
        uint256 maxStreak;
        uint256[MAX_ATTEMPTS] winDistribution;
        uint256 bestTime;
    }
    
    // ОСНОВНЫЕ ДАННЫЕ
    mapping(address => GameData) public games;
    mapping(address => euint8[WORD_LENGTH]) private encryptedSecretWords;
    mapping(address => uint8[MAX_ATTEMPTS][WORD_LENGTH]) private plainTextGuesses; // Для тестирования
    mapping(address => bool) public hasActiveGame;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256) public lastGameStartTime;
    
    // КОНТРОЛЬ
    address public owner;
    bool public isPaused;
    uint256 public totalGamesPlayed;
    uint256 public activeGamesCount;
    uint256 public totalPlayers;
    bool public testMode = true;
    uint256 public constant wordBankSize = 4;
    
    // СОБЫТИЯ
    event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex);
    event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp);
    event GameCompleted(address indexed player, uint256 indexed gameId, GameStatus finalStatus, uint8 totalAttempts, uint256 duration, bool isWin);
    event NewPersonalBest(address indexed player, uint256 gameTime, uint8 attempts);
    event StreakMilestone(address indexed player, uint256 streakLength);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier whenNotPaused() {
        require(!isPaused, "Game is paused");
        _;
    }
    
    modifier rateLimited() {
        require(
            block.timestamp >= lastGameStartTime[msg.sender] + MIN_GAME_INTERVAL,
            "Too frequent game starts"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
        isPaused = false;
    }
    
    // ПРОСТАЯ ИНИЦИАЛИЗАЦИЯ (БЕЗ TFHE ПОКА)
    function initializeWordBank() external onlyOwner {
        // Просто помечаем как готовые - зашифрованные слова будут создаваться динамически
        // В production здесь будут TFHE.asEuint8() операции
    }
    
    function startGame(bytes32 sessionHash) external whenNotPaused rateLimited {
        if (_canRecoverGame(sessionHash)) {
            games[msg.sender].endTime = block.timestamp;
            emit GameStarted(msg.sender, games[msg.sender].gameId, sessionHash, block.timestamp, games[msg.sender].wordIndex);
            return;
        }
        
        if (hasActiveGame[msg.sender]) {
            _abandonGame(GameStatus.Abandoned);
        }
        
        uint256 gameId = _generateGameId();
        uint256 wordIndex = _selectRandomWord();
        
        GameData storage newGame = games[msg.sender];
        newGame.gameId = gameId;
        newGame.player = msg.sender;
        newGame.currentAttempt = 0;
        newGame.status = GameStatus.InProgress;
        newGame.startTime = block.timestamp;
        newGame.endTime = 0;
        newGame.sessionHash = sessionHash;
        newGame.wordIndex = wordIndex;
        newGame.canRecover = true;
        
        // В ТЕСТОВОМ РЕЖИМЕ НЕ ИНИЦИАЛИЗИРУЕМ ЗАШИФРОВАННЫЕ ДАННЫЕ
        // В production здесь будет копирование из encryptedWordBank
        
        hasActiveGame[msg.sender] = true;
        lastGameStartTime[msg.sender] = block.timestamp;
        activeGamesCount++;
        totalGamesPlayed++;
        
        if (playerStats[msg.sender].totalGames == 0) {
            totalPlayers++;
        }
        playerStats[msg.sender].totalGames++;
        
        emit GameStarted(msg.sender, gameId, sessionHash, block.timestamp, wordIndex);
    }
    
    function submitGuess(uint8[WORD_LENGTH] calldata guess) external whenNotPaused {
        require(hasActiveGame[msg.sender], "No active game");
        GameData storage game = games[msg.sender];
        require(game.status == GameStatus.InProgress, "Game not in progress");
        require(game.currentAttempt < MAX_ATTEMPTS, "No attempts remaining");
        require(block.timestamp <= game.startTime + GAME_TIMEOUT, "Game expired");
        
        uint8 attemptIndex = game.currentAttempt;
        
        // СОХРАНЯЕМ PLAIN TEXT
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            require(guess[i] >= 1 && guess[i] <= 26, "Invalid letter");
            plainTextGuesses[msg.sender][attemptIndex][i] = guess[i];
        }
        
        game.currentAttempt++;
        
        // ПРОВЕРЯЕМ ПОБЕДУ
        _checkWinSimple(attemptIndex);
        
        emit GuessSubmitted(msg.sender, game.gameId, attemptIndex, block.timestamp);
    }
    
    function _checkWinSimple(uint8 attemptIndex) private {
        if (!testMode) return;
        
        bool isWin = _checkGuessAgainstWordIndex(attemptIndex, games[msg.sender].wordIndex);
        
        if (isWin) {
            _completeGame(GameStatus.Won);
        } else if (games[msg.sender].currentAttempt >= MAX_ATTEMPTS) {
            _completeGame(GameStatus.Lost);
        }
    }
    
    function _checkGuessAgainstWordIndex(uint8 attemptIndex, uint256 wordIndex) private view returns (bool) {
        uint8[WORD_LENGTH][4] memory wordBank = [
            [8, 5, 12, 12, 15],   // HELLO
            [23, 15, 18, 12, 4],  // WORLD  
            [8, 15, 21, 19, 5],   // HOUSE
            [13, 21, 19, 9, 3]    // MUSIC
        ];
        
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (plainTextGuesses[msg.sender][attemptIndex][i] != wordBank[wordIndex][i]) {
                return false;
            }
        }
        return true;
    }
    
    function _completeGame(GameStatus finalStatus) private {
        GameData storage game = games[msg.sender];
        PlayerStats storage stats = playerStats[msg.sender];
        
        game.status = finalStatus;
        game.endTime = block.timestamp;
        game.canRecover = false;
        activeGamesCount--;
        
        uint256 duration = game.endTime - game.startTime;
        bool isWin = (finalStatus == GameStatus.Won);
        
        if (isWin) {
            stats.gamesWon++;
            stats.currentStreak++;
            
            if (stats.currentStreak > stats.maxStreak) {
                stats.maxStreak = stats.currentStreak;
            }
            
            if (game.currentAttempt > 0) {
                stats.winDistribution[game.currentAttempt - 1]++;
            }
            
            if (stats.bestTime == 0 || duration < stats.bestTime) {
                stats.bestTime = duration;
                emit NewPersonalBest(msg.sender, duration, game.currentAttempt);
            }
            
            if (stats.currentStreak % 5 == 0) {
                emit StreakMilestone(msg.sender, stats.currentStreak);
            }
        } else {
            stats.currentStreak = 0;
        }
        
        hasActiveGame[msg.sender] = false;
        
        emit GameCompleted(msg.sender, game.gameId, finalStatus, game.currentAttempt, duration, isWin);
    }
    
    function _canRecoverGame(bytes32 sessionHash) private view returns (bool) {
        return hasActiveGame[msg.sender] &&
               games[msg.sender].status == GameStatus.InProgress &&
               games[msg.sender].sessionHash == sessionHash &&
               games[msg.sender].canRecover &&
               block.timestamp <= games[msg.sender].startTime + GAME_TIMEOUT;
    }
    
    function _generateGameId() private view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            totalGamesPlayed
        )));
    }
    
    function _selectRandomWord() private view returns (uint256) {
        uint256 randomSeed = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            block.prevrandao
        )));
        return randomSeed % wordBankSize;
    }
    
    function _abandonGame(GameStatus reason) private {
        if (games[msg.sender].status == GameStatus.InProgress) {
            activeGamesCount--;
        }
        games[msg.sender].status = reason;
        games[msg.sender].endTime = block.timestamp;
        games[msg.sender].canRecover = false;
        hasActiveGame[msg.sender] = false;
    }
    
    // VIEW FUNCTIONS
    function getGameState(bytes32 sessionHash) external view returns (
        bool exists, bool canRecover, uint256 gameId, GameStatus status,
        uint8 currentAttempt, uint256 startTime, uint256 timeRemaining, bool hasExpired
    ) {
        GameData storage game = games[msg.sender];
        exists = hasActiveGame[msg.sender];
        if (!exists) return (false, false, 0, GameStatus.NotStarted, 0, 0, 0, false);
        
        canRecover = _canRecoverGame(sessionHash);
        gameId = game.gameId;
        status = game.status;
        currentAttempt = game.currentAttempt;
        startTime = game.startTime;
        
        uint256 elapsed = block.timestamp - game.startTime;
        timeRemaining = elapsed < GAME_TIMEOUT ? GAME_TIMEOUT - elapsed : 0;
        hasExpired = elapsed >= GAME_TIMEOUT;
    }
    
    function getSecretWord() external view returns (uint8[WORD_LENGTH] memory) {
        require(hasActiveGame[msg.sender], "No active game");
        require(testMode, "Secret word hidden in production mode");
        
        uint256 wordIndex = games[msg.sender].wordIndex;
        
        uint8[WORD_LENGTH] memory word;
        if (wordIndex == 0) {
            word = [8, 5, 12, 12, 15];   // HELLO
        } else if (wordIndex == 1) {
            word = [23, 15, 18, 12, 4];  // WORLD
        } else if (wordIndex == 2) {
            word = [8, 15, 21, 19, 5];   // HOUSE
        } else if (wordIndex == 3) {
            word = [13, 21, 19, 9, 3];   // MUSIC
        }
        return word;
    }
    
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    function getContractStats() external view returns (uint256 totalGames, uint256 activeGames, uint256 totalWords, uint256 players, bool paused) {
        return (totalGamesPlayed, activeGamesCount, wordBankSize, totalPlayers, isPaused);
    }
    
    // ADMIN FUNCTIONS
    function pauseGame(string calldata /* reason */) external onlyOwner {
        isPaused = true;
    }
    
    function unpauseGame() external onlyOwner {
        isPaused = false;
    }
    
    function setTestMode(bool _testMode) external onlyOwner {
        testMode = _testMode;
    }
    
    function forfeitGame() external {
        require(hasActiveGame[msg.sender], "No active game");
        _completeGame(GameStatus.Lost);
    }
    
    // DEBUG FUNCTIONS
    function debugWordBank() external view returns (uint256, uint256, bool) {
        return (wordBankSize, wordBankSize, testMode);
    }
    
    function debugGameStatus(address player) external view returns (uint8, bool, uint256) {
        GameData storage game = games[player];
        return (
            uint8(game.status),
            hasActiveGame[player], 
            game.gameId
        );
    }
}