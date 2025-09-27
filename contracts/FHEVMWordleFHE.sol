// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHEVMWordleFHE_Fixed is SepoliaConfig {
    using FHE for euint8;
    
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
        uint256 pendingRequestId;
    }
    
    struct PlayerStats {
        uint256 totalGames;
        uint256 gamesWon;
        uint256 currentStreak;
        uint256 maxStreak;
        uint256[MAX_ATTEMPTS] winDistribution;
        uint256 bestTime;
    }
    
    // ЗАШИФРОВАННЫЕ ДАННЫЕ! 🔒
    mapping(address => GameData) public games;
    mapping(address => euint8[WORD_LENGTH]) private encryptedSecretWords;
    mapping(address => euint8[MAX_ATTEMPTS][WORD_LENGTH]) private encryptedGuesses;
    mapping(address => euint8[MAX_ATTEMPTS][WORD_LENGTH]) private encryptedResults;
    
    // ДЛЯ ТЕСТИРОВАНИЯ
    mapping(address => uint8[MAX_ATTEMPTS][WORD_LENGTH]) private plainTextGuesses;
    mapping(address => uint8[MAX_ATTEMPTS][WORD_LENGTH]) private plainTextResults;
    
    // СОСТОЯНИЕ
    mapping(address => bool) public hasActiveGame;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256) public lastGameStartTime;
    mapping(uint256 => address) private decryptionRequests;
    
    // КОНТРОЛЬ
    address public owner;
    bool public isPaused;
    uint256 public totalGamesPlayed;
    uint256 public activeGamesCount;
    uint256 public totalPlayers;
    bool public testMode = true;
    uint256 public constant wordBankSize = 10;
    uint256 public latestRequestId;
    
    // СОБЫТИЯ
    event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex);
    event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp);
    event GameCompleted(address indexed player, uint256 indexed gameId, GameStatus finalStatus, uint8 totalAttempts, uint256 duration, bool isWin);
    event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[WORD_LENGTH] results); // NEW!
    event DecryptionRequested(address indexed player, uint256 indexed requestId, uint8 attemptNumber); // NEW!
    
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
        newGame.pendingRequestId = 0;
        
        if (!testMode) {
            _createEncryptedSecretWord(wordIndex);
        }
        
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
    
    function _createEncryptedSecretWord(uint256 wordIndex) private {
        uint8[WORD_LENGTH][10] memory wordBank = [
            [8, 5, 12, 12, 15],   // HELLO
            [23, 15, 18, 12, 4],  // WORLD
            [8, 15, 21, 19, 5],   // HOUSE
            [13, 21, 19, 9, 3],   // MUSIC
            [2, 12, 1, 3, 11],    // BLACK
            [7, 18, 5, 5, 14],    // GREEN
            [16, 1, 16, 5, 18],   // PAPER
            [20, 1, 2, 12, 5],    // TABLE
            [12, 9, 7, 8, 20],    // LIGHT
            [23, 1, 20, 5, 18]    // WATER
        ];
        
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            encryptedSecretWords[msg.sender][i] = FHE.asEuint8(wordBank[wordIndex][i]);
            FHE.allowThis(encryptedSecretWords[msg.sender][i]);
        }
    }
    
    function submitGuess(uint8[WORD_LENGTH] calldata guess) external whenNotPaused {
        require(hasActiveGame[msg.sender], "No active game");
        GameData storage game = games[msg.sender];
        require(game.status == GameStatus.InProgress, "Game not in progress");
        require(game.currentAttempt < MAX_ATTEMPTS, "No attempts remaining");
        require(block.timestamp <= game.startTime + GAME_TIMEOUT, "Game expired");
        
        uint8 attemptIndex = game.currentAttempt;
        
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            require(guess[i] >= 1 && guess[i] <= 26, "Invalid letter");
            plainTextGuesses[msg.sender][attemptIndex][i] = guess[i];
            
            if (!testMode) {
                encryptedGuesses[msg.sender][attemptIndex][i] = FHE.asEuint8(guess[i]);
                FHE.allowThis(encryptedGuesses[msg.sender][attemptIndex][i]);
            }
        }
        
        if (!testMode) {
            _evaluateEncryptedGuess(attemptIndex);
        } else {
            _evaluateGuessTestMode(attemptIndex);
        }
        
        game.currentAttempt++;
        
        if (testMode) {
            _checkWinTestMode(attemptIndex);
        }
        
        emit GuessSubmitted(msg.sender, game.gameId, attemptIndex, block.timestamp);
    }
    
    // ПОЛНАЯ WORDLE ЛОГИКА С FHE! 🔒⚡
    function _evaluateEncryptedGuess(uint8 attemptIndex) private {
        for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
            euint8 guessLetter = encryptedGuesses[msg.sender][attemptIndex][pos];
            euint8 secretLetter = encryptedSecretWords[msg.sender][pos];
            
            // 1. ПРОВЕРЯЕМ ТОЧНОЕ СОВПАДЕНИЕ (CORRECT)
            ebool isExactMatch = FHE.eq(guessLetter, secretLetter);
            
            // 2. ПРОВЕРЯЕМ ЕСТЬ ЛИ БУКВА В ДРУГИХ ПОЗИЦИЯХ (PRESENT)
            ebool isPresentElsewhere = FHE.asEbool(false);
            for (uint8 otherPos = 0; otherPos < WORD_LENGTH; otherPos++) {
                if (otherPos != pos) {
                    ebool matchesOtherPos = FHE.eq(guessLetter, encryptedSecretWords[msg.sender][otherPos]);
                    isPresentElsewhere = FHE.or(isPresentElsewhere, matchesOtherPos);
                }
            }
            
            // 3. ОПРЕДЕЛЯЕМ РЕЗУЛЬТАТ
            // 3 = Correct (зеленый), 2 = Present (желтый), 1 = Absent (серый)
            euint8 result = FHE.asEuint8(1); // Default: Absent
            
            // Если есть в слове, но не на этой позиции - Present (2)
            ebool notExactButPresent = FHE.and(FHE.not(isExactMatch), isPresentElsewhere);
            result = FHE.select(notExactButPresent, FHE.asEuint8(2), result);
            
            // Если точное совпадение - Correct (3) (перезаписывает Present)
            result = FHE.select(isExactMatch, FHE.asEuint8(3), result);
            
            encryptedResults[msg.sender][attemptIndex][pos] = result;
            FHE.allowThis(encryptedResults[msg.sender][attemptIndex][pos]);
        }
    }
    
    // ПОЛНАЯ WORDLE ЛОГИКА ДЛЯ TEST MODE! 🧪
    function _evaluateGuessTestMode(uint8 attemptIndex) private {
        uint8[WORD_LENGTH][10] memory wordBank = [
            [8, 5, 12, 12, 15],   // HELLO
            [23, 15, 18, 12, 4],  // WORLD
            [8, 15, 21, 19, 5],   // HOUSE
            [13, 21, 19, 9, 3],   // MUSIC
            [2, 12, 1, 3, 11],    // BLACK
            [7, 18, 5, 5, 14],    // GREEN
            [16, 1, 16, 5, 18],   // PAPER
            [20, 1, 2, 12, 5],    // TABLE
            [12, 9, 7, 8, 20],    // LIGHT
            [23, 1, 20, 5, 18]    // WATER
        ];
        
        uint256 wordIndex = games[msg.sender].wordIndex;
        uint8[WORD_LENGTH] memory secretWord = wordBank[wordIndex];
        
        for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
            uint8 guessLetter = plainTextGuesses[msg.sender][attemptIndex][pos];
            uint8 secretLetter = secretWord[pos];
            
            // 1. ПРОВЕРЯЕМ ТОЧНОЕ СОВПАДЕНИЕ (CORRECT)
            if (guessLetter == secretLetter) {
                plainTextResults[msg.sender][attemptIndex][pos] = 3; // Correct
                continue;
            }
            
            // 2. ПРОВЕРЯЕМ ЕСТЬ ЛИ БУКВА В ДРУГИХ ПОЗИЦИЯХ (PRESENT)
            bool isPresentElsewhere = false;
            for (uint8 otherPos = 0; otherPos < WORD_LENGTH; otherPos++) {
                if (otherPos != pos && guessLetter == secretWord[otherPos]) {
                    isPresentElsewhere = true;
                    break;
                }
            }
            
            // 3. ОПРЕДЕЛЯЕМ РЕЗУЛЬТАТ
            if (isPresentElsewhere) {
                plainTextResults[msg.sender][attemptIndex][pos] = 2; // Present
            } else {
                plainTextResults[msg.sender][attemptIndex][pos] = 1; // Absent
            }
        }
        
        // ОТПРАВЛЯЕМ РЕЗУЛЬТАТЫ В TEST MODE
        uint8[WORD_LENGTH] memory resultsCopy;
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            resultsCopy[i] = plainTextResults[msg.sender][attemptIndex][i];
        }
        emit GuessEvaluated(msg.sender, attemptIndex, resultsCopy);
    }
    
    // ЗАПРОС РАСШИФРОВКИ РЕЗУЛЬТАТОВ В PROD MODE! 🔓
    function requestDecryptResults() external {
        require(!testMode, "Auto-evaluation in test mode");
        require(hasActiveGame[msg.sender], "No active game");
        GameData storage game = games[msg.sender];
        require(game.currentAttempt > 0, "No attempts made");
        require(game.pendingRequestId == 0, "Request already pending");
        
        uint8 lastAttempt = game.currentAttempt - 1;
        
        // ПОДГОТАВЛИВАЕМ ЗАШИФРОВАННЫЕ РЕЗУЛЬТАТЫ ДЛЯ РАСШИФРОВКИ
        bytes32[] memory cts = new bytes32[](WORD_LENGTH);
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            cts[i] = FHE.toBytes32(encryptedResults[msg.sender][lastAttempt][i]);
        }
        
        // ЗАПРАШИВАЕМ РАСШИФРОВКУ
        uint256 requestId = FHE.requestDecryption(cts, this.resultsCallback.selector);
        
        game.pendingRequestId = requestId;
        latestRequestId = requestId;
        decryptionRequests[requestId] = msg.sender;
        
        emit DecryptionRequested(msg.sender, requestId, lastAttempt);
    }
    
    // CALLBACK ДЛЯ РЕЗУЛЬТАТА РАСШИФРОВКИ! 🔓
    function resultsCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) public returns (bool) {
        address player = decryptionRequests[requestId];
        require(player != address(0), "Invalid request ID");
        require(hasActiveGame[player], "No active game");
        
        GameData storage game = games[player];
        require(game.pendingRequestId == requestId, "Invalid pending request");
        
        // ПРАВИЛЬНАЯ SIGNATURE - 3 ПАРАМЕТРА! 🔧
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        
        // ДЕКОДИРУЕМ РЕЗУЛЬТАТЫ [3,1,2,1,3] etc
        uint8[] memory decodedResults = abi.decode(cleartexts, (uint8[]));
        uint8[WORD_LENGTH] memory results;
        for (uint8 i = 0; i < WORD_LENGTH && i < decodedResults.length; i++) {
            results[i] = decodedResults[i];
        }
        
        // ПРОВЕРЯЕМ ПОБЕДУ
        bool isWin = true;
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (results[i] != 3) {
                isWin = false;
                break;
            }
        }
        
        // ОЧИЩАЕМ ЗАПРОС
        game.pendingRequestId = 0;
        delete decryptionRequests[requestId];
        
        // ОТПРАВЛЯЕМ РЕЗУЛЬТАТЫ
        emit GuessEvaluated(player, game.currentAttempt - 1, results);
        
        // ЗАВЕРШАЕМ ИГРУ
        if (isWin) {
            _completeGameForPlayer(player, GameStatus.Won);
        } else if (game.currentAttempt >= MAX_ATTEMPTS) {
            _completeGameForPlayer(player, GameStatus.Lost);
        }
        
        return isWin;
    }



    
    // ПОЛУЧИТЬ РЕЗУЛЬТАТЫ ПОСЛЕДНЕЙ ПОПЫТКИ В TEST MODE
    function getLastGuessResults() external view returns (uint8[WORD_LENGTH] memory) {
        require(testMode, "Use decryption oracle in prod mode");
        require(hasActiveGame[msg.sender], "No active game");
        
        GameData storage game = games[msg.sender];
        require(game.currentAttempt > 0, "No attempts made");
        
        uint8 lastAttempt = game.currentAttempt - 1;
        
        // СОЗДАЕМ ВРЕМЕННЫЙ МАССИВ ПРАВИЛЬНОГО РАЗМЕРА! 🔧
        uint8[WORD_LENGTH] memory results;
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            results[i] = plainTextResults[msg.sender][lastAttempt][i];
        }
        return results;
    }

    
    // ПОЛУЧИТЬ ВСЕ РЕЗУЛЬТАТЫ В TEST MODE
    function getAllGuessResults() external view returns (uint8[MAX_ATTEMPTS][WORD_LENGTH] memory) {
        require(testMode, "Use decryption oracle in prod mode");
        require(hasActiveGame[msg.sender], "No active game");
        
        // СОЗДАЕМ ВРЕМЕННЫЙ МАССИВ ПРАВИЛЬНОГО РАЗМЕРА! 🔧
        uint8[MAX_ATTEMPTS][WORD_LENGTH] memory results;
        for (uint8 attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
                results[attempt][pos] = plainTextResults[msg.sender][attempt][pos];
            }
        }
        return results;
    }

    
    function _checkWinTestMode(uint8 attemptIndex) private {
        if (!testMode) return;
        
        // ПРОВЕРЯЕМ ПО РЕЗУЛЬТАТАМ
        bool isWin = true;
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            if (plainTextResults[msg.sender][attemptIndex][i] != 3) {
                isWin = false;
                break;
            }
        }
        
        if (isWin) {
            _completeGame(GameStatus.Won);
        } else if (games[msg.sender].currentAttempt >= MAX_ATTEMPTS) {
            _completeGame(GameStatus.Lost);
        }
    }
    
    function _completeGameForPlayer(address player, GameStatus finalStatus) private {
        GameData storage game = games[player];
        PlayerStats storage stats = playerStats[player];
        
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
            }
        } else {
            stats.currentStreak = 0;
        }
        
        hasActiveGame[player] = false;
        
        emit GameCompleted(player, game.gameId, finalStatus, game.currentAttempt, duration, isWin);
    }
    
    function _completeGame(GameStatus finalStatus) private {
        _completeGameForPlayer(msg.sender, finalStatus);
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
        games[msg.sender].pendingRequestId = 0;
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
        if (wordIndex == 0) { word = [8, 5, 12, 12, 15]; }   // HELLO
        else if (wordIndex == 1) { word = [23, 15, 18, 12, 4]; }  // WORLD
        else if (wordIndex == 2) { word = [8, 15, 21, 19, 5]; }   // HOUSE
        else if (wordIndex == 3) { word = [13, 21, 19, 9, 3]; }   // MUSIC
        else if (wordIndex == 4) { word = [2, 12, 1, 3, 11]; }    // BLACK
        else if (wordIndex == 5) { word = [7, 18, 5, 5, 14]; }    // GREEN
        else if (wordIndex == 6) { word = [16, 1, 16, 5, 18]; }   // PAPER
        else if (wordIndex == 7) { word = [20, 1, 2, 12, 5]; }    // TABLE
        else if (wordIndex == 8) { word = [12, 9, 7, 8, 20]; }    // LIGHT
        else if (wordIndex == 9) { word = [23, 1, 20, 5, 18]; }   // WATER
        
        return word;
    }
    
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }
    
    function setTestMode(bool _testMode) external onlyOwner {
        testMode = _testMode;
    }
    
    function pauseGame(string calldata /* reason */) external onlyOwner {
        isPaused = true;
    }
    
    function unpauseGame() external onlyOwner {
        isPaused = false;
    }
    
    function forfeitGame() external {
        require(hasActiveGame[msg.sender], "No active game");
        _completeGame(GameStatus.Lost);
    }
    
    function debugWordBank() external pure returns (uint256, uint256, bool) {
        return (10, 10, true);
    }
}
