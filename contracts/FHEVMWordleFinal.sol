// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract FHEVMWordleFinal {
    uint8 public constant WORD_LENGTH = 5;
    uint8 public constant MAX_ATTEMPTS = 6;
    uint256 public constant GAME_TIMEOUT = 24 hours;
    uint256 public constant MIN_GAME_INTERVAL = 30 seconds;
    
    enum GameStatus { NotStarted, InProgress, Won, Lost, Expired, Abandoned }
    enum LetterResult { Unknown, Absent, Present, Correct }
    
    // ПРОСТАЯ СТРУКТУРА БЕЗ БОЛЬШИХ МАССИВОВ
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
    
    // ОСНОВНЫЕ ДАННЫЕ ИГРЫ - РАЗДЕЛЕННЫЕ MAPPING
    mapping(address => GameData) public games;
    mapping(address => uint8[WORD_LENGTH]) private secretWords;
    mapping(address => uint8[MAX_ATTEMPTS][WORD_LENGTH]) private guesses;
    mapping(address => uint8[MAX_ATTEMPTS][WORD_LENGTH]) private letterResults;
    
    // СОСТОЯНИЕ И СТАТИСТИКА
    mapping(address => bool) public hasActiveGame;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256) public lastGameStartTime;
    
    // WORD BANK
    mapping(uint256 => uint8[WORD_LENGTH]) private wordBank;
    uint256 public constant wordBankSize = 10;
    
    // КОНТРОЛЬ
    address public owner;
    bool public isPaused;
    uint256 public totalGamesPlayed;
    uint256 public activeGamesCount;
    uint256 public totalPlayers;
    
    // СОБЫТИЯ
    event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex);
    event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp);
    event GameCompleted(address indexed player, uint256 indexed gameId, GameStatus finalStatus, uint8 totalAttempts, uint256 duration, bool isWin);
    event NewPersonalBest(address indexed player, uint256 gameTime, uint8 attempts);
    event StreakMilestone(address indexed player, uint256 streakLength);
    event EmergencyPause(address indexed admin, string reason);
    event EmergencyUnpause(address indexed admin);
    
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
        _initializeWordBank();
    }
    
    function _initializeWordBank() private {
        wordBank[0] = [8, 5, 12, 12, 15];   // HELLO
        wordBank[1] = [23, 15, 18, 12, 4];  // WORLD  
        wordBank[2] = [8, 15, 21, 19, 5];   // HOUSE
        wordBank[3] = [7, 18, 5, 5, 14];    // GREEN
        wordBank[4] = [2, 12, 1, 3, 11];    // BLACK
        wordBank[5] = [13, 21, 19, 9, 3];   // MUSIC
        wordBank[6] = [16, 1, 16, 5, 18];   // PAPER
        wordBank[7] = [20, 1, 2, 12, 5];    // TABLE
        wordBank[8] = [12, 9, 7, 8, 20];    // LIGHT
        wordBank[9] = [23, 1, 20, 5, 18];   // WATER
    }
    
    function startGame(bytes32 sessionHash) external whenNotPaused rateLimited {
        // Проверяем recovery
        if (_canRecoverGame(sessionHash)) {
            games[msg.sender].endTime = block.timestamp; // Update activity
            emit GameStarted(msg.sender, games[msg.sender].gameId, sessionHash, block.timestamp, games[msg.sender].wordIndex);
            return;
        }
        
        // Завершаем старую игру если есть
        if (hasActiveGame[msg.sender]) {
            _abandonGame(GameStatus.Abandoned);
        }
        
        // Создаем новую игру
        uint256 gameId = _generateGameId();
        uint256 wordIndex = _selectRandomWord();
        
        // ИНИЦИАЛИЗИРУЕМ ПРОСТУЮ СТРУКТУРУ
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
        
        // КОПИРУЕМ СЕКРЕТНОЕ СЛОВО В ОТДЕЛЬНЫЙ MAPPING
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            secretWords[msg.sender][i] = wordBank[wordIndex][i];
        }
        
        // ОЧИЩАЕМ МАССИВЫ ПОПЫТОК (инициализация не нужна, они уже 0)
        // guesses и letterResults автоматически инициализированы нулями
        
        // ОБНОВЛЯЕМ СОСТОЯНИЕ
        hasActiveGame[msg.sender] = true;
        lastGameStartTime[msg.sender] = block.timestamp;
        activeGamesCount++;
        totalGamesPlayed++;
        
        // ОБНОВЛЯЕМ СТАТИСТИКУ ИГРОКА
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
        
        // Валидация ввода
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            require(guess[i] >= 1 && guess[i] <= 26, "Invalid letter");
        }
        
        uint8 attemptIndex = game.currentAttempt;
        
        // СОХРАНЯЕМ ПОПЫТКУ В ОТДЕЛЬНОМ MAPPING
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            guesses[msg.sender][attemptIndex][i] = guess[i];
        }
        
        // ОЦЕНИВАЕМ ПОПЫТКУ
        _evaluateGuess(attemptIndex);
        
        game.currentAttempt++;
        
        // ПРОВЕРЯЕМ ПОБЕДУ
        bool hasWon = _checkWin(attemptIndex);
        
        if (hasWon) {
            _completeGame(GameStatus.Won);
        } else if (game.currentAttempt >= MAX_ATTEMPTS) {
            _completeGame(GameStatus.Lost);
        }
        
        emit GuessSubmitted(msg.sender, game.gameId, attemptIndex, block.timestamp);
    }
    
    function _evaluateGuess(uint8 attemptIndex) private {
        uint8[WORD_LENGTH] memory letterCounts;
        uint8[WORD_LENGTH] memory exactMatches;
        
        // First pass: exact matches
        for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
            if (guesses[msg.sender][attemptIndex][pos] == secretWords[msg.sender][pos]) {
                exactMatches[pos] = 1;
                letterResults[msg.sender][attemptIndex][pos] = uint8(LetterResult.Correct);
            } else {
                exactMatches[pos] = 0;
            }
        }
        
        // Second pass: present letters
        for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
            if (exactMatches[pos] == 0) {
                bool isPresent = false;
                
                // Count occurrences in secret word
                for (uint8 i = 0; i < WORD_LENGTH; i++) {
                    if (secretWords[msg.sender][i] == guesses[msg.sender][attemptIndex][pos] && exactMatches[i] == 0) {
                        isPresent = true;
                        break;
                    }
                }
                
                if (isPresent) {
                    letterResults[msg.sender][attemptIndex][pos] = uint8(LetterResult.Present);
                } else {
                    letterResults[msg.sender][attemptIndex][pos] = uint8(LetterResult.Absent);
                }
            }
        }
    }
    
    function _checkWin(uint8 attemptIndex) private view returns (bool) {
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (letterResults[msg.sender][attemptIndex][i] != uint8(LetterResult.Correct)) {
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
    
    function getGuessResults(uint8 attemptNumber) external view returns (uint8[WORD_LENGTH] memory, uint8[WORD_LENGTH] memory) {
        require(hasActiveGame[msg.sender], "No active game");
        require(attemptNumber < games[msg.sender].currentAttempt, "Attempt not made yet");
        
        uint8[WORD_LENGTH] memory guess;
        uint8[WORD_LENGTH] memory results;
        
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            guess[i] = guesses[msg.sender][attemptNumber][i];
            results[i] = letterResults[msg.sender][attemptNumber][i];
        }
        
        return (guess, results);
    }
    
    function getSecretWord() external view returns (uint8[WORD_LENGTH] memory) {
        require(hasActiveGame[msg.sender], "No active game");
        return secretWords[msg.sender];
    }
    
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    function getContractStats() external view returns (uint256 totalGames, uint256 activeGames, uint256 totalWords, uint256 players, bool paused) {
        return (totalGamesPlayed, activeGamesCount, wordBankSize, totalPlayers, isPaused);
    }
    
    // ADMIN FUNCTIONS
    function pauseGame(string calldata reason) external onlyOwner {
        isPaused = true;
        emit EmergencyPause(msg.sender, reason);
    }
    
    function unpauseGame() external onlyOwner {
        isPaused = false;
        emit EmergencyUnpause(msg.sender);
    }
    
    function forfeitGame() external {
        require(hasActiveGame[msg.sender], "No active game");
        _completeGame(GameStatus.Lost);
    }
    
    // DEBUG FUNCTIONS
    function debugWordBank() external pure returns (uint256, uint256, bool) {
        return (10, 10, true);
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
