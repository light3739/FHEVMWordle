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

        // Хранилище
        mapping(address => GameData) public games;
        mapping(address => euint8[WORD_LENGTH]) private encryptedSecretWords;

        // Матрицы попыток/позиций: [attempt][pos]
        mapping(address => euint8[WORD_LENGTH][MAX_ATTEMPTS]) private encryptedGuesses;
        mapping(address => euint8[WORD_LENGTH][MAX_ATTEMPTS]) private encryptedResults;

        // Тестовые (plaintext) матрицы: [attempt][pos]
        mapping(address => uint8[WORD_LENGTH][MAX_ATTEMPTS]) private plainTextGuesses;
        mapping(address => uint8[WORD_LENGTH][MAX_ATTEMPTS]) private plainTextResults;

        mapping(address => bool) public hasActiveGame;
        mapping(address => PlayerStats) public playerStats;
        mapping(address => uint256) public lastGameStartTime;
        mapping(uint256 => address) private decryptionRequests;

        address public owner;
        bool public isPaused;
        uint256 public totalGamesPlayed;
        uint256 public activeGamesCount;
        uint256 public totalPlayers;
        bool public testMode = true;
        uint256 public constant wordBankSize = 10;
        uint256 public latestRequestId;

        event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex);
        event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp);
        event GameCompleted(address indexed player, uint256 indexed gameId, GameStatus finalStatus, uint8 totalAttempts, uint256 duration, bool isWin);
        event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[WORD_LENGTH] results);

        modifier onlyOwner() {
            require(msg.sender == owner, "Only owner");
            _;
        }

        modifier whenNotPaused() {
            require(!isPaused, "Game is paused");
            _;
        }

        modifier rateLimited() {
            require(block.timestamp >= lastGameStartTime[msg.sender] + MIN_GAME_INTERVAL, "Too frequent game starts");
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

        // Оценка догадки в PROD (на зашифрованных данных)
        function _evaluateEncryptedGuess(uint8 attemptIndex) private {
            for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
                euint8 guessLetter = encryptedGuesses[msg.sender][attemptIndex][pos];
                euint8 secretLetter = encryptedSecretWords[msg.sender][pos];

                ebool isExactMatch = FHE.eq(guessLetter, secretLetter);

                ebool isPresentElsewhere = FHE.asEbool(false);
                for (uint8 otherPos = 0; otherPos < WORD_LENGTH; otherPos++) {
                    if (otherPos != pos) {
                        ebool matchesOtherPos = FHE.eq(guessLetter, encryptedSecretWords[msg.sender][otherPos]);
                        isPresentElsewhere = FHE.or(isPresentElsewhere, matchesOtherPos);
                    }
                }

                euint8 result = FHE.asEuint8(1); // Absent
                ebool notExactButPresent = FHE.and(FHE.not(isExactMatch), isPresentElsewhere);
                result = FHE.select(notExactButPresent, FHE.asEuint8(2), result); // Present
                result = FHE.select(isExactMatch, FHE.asEuint8(3), result);       // Correct

                encryptedResults[msg.sender][attemptIndex][pos] = result;
                FHE.allowThis(encryptedResults[msg.sender][attemptIndex][pos]);
            }
        }

        // Тестовая оценка (plaintext)
        function _evaluateGuessTestMode(uint8 attemptIndex) private {
            uint8[WORD_LENGTH][10] memory wordBank = [
                [8, 5, 12, 12, 15],
                [23, 15, 18, 12, 4],
                [8, 15, 21, 19, 5],
                [13, 21, 19, 9, 3],
                [2, 12, 1, 3, 11],
                [7, 18, 5, 5, 14],
                [16, 1, 16, 5, 18],
                [20, 1, 2, 12, 5],
                [12, 9, 7, 8, 20],
                [23, 1, 20, 5, 18]
            ];

            uint256 wordIndex = games[msg.sender].wordIndex;
            uint8[WORD_LENGTH] memory secretWord = wordBank[wordIndex];

            for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
                uint8 guessLetter = plainTextGuesses[msg.sender][attemptIndex][pos];
                uint8 secretLetter = secretWord[pos];

                if (guessLetter == secretLetter) {
                    plainTextResults[msg.sender][attemptIndex][pos] = 3;
                    continue;
                }

                bool isPresentElsewhere = false;
                for (uint8 otherPos = 0; otherPos < WORD_LENGTH; otherPos++) {
                    if (otherPos != pos && guessLetter == secretWord[otherPos]) {
                        isPresentElsewhere = true;
                        break;
                    }
                }

                plainTextResults[msg.sender][attemptIndex][pos] = isPresentElsewhere ? 2 : 1;
            }

            uint8[WORD_LENGTH] memory resultsCopy;
            for (uint8 i = 0; i < WORD_LENGTH; i++) {
                resultsCopy[i] = plainTextResults[msg.sender][attemptIndex][i];
            }
            emit GuessEvaluated(msg.sender, attemptIndex, resultsCopy);
        }

        // PROD: запрос на дешифрование последней попытки
        function requestDecryptResults() external {
            require(!testMode, "Auto-evaluation in test mode");
            require(hasActiveGame[msg.sender], "No active game");
            GameData storage game = games[msg.sender];
            require(game.currentAttempt > 0, "No attempts made");
            require(game.pendingRequestId == 0, "Request already pending");

            uint8 lastAttempt = game.currentAttempt - 1;

            bytes32[] memory cts = new bytes32[](WORD_LENGTH);
            for (uint8 i = 0; i < WORD_LENGTH; i++) {
                cts[i] = FHE.toBytes32(encryptedResults[msg.sender][lastAttempt][i]);
            }

            uint256 requestId = FHE.requestDecryption(cts, this.resultsCallback.selector);
            game.pendingRequestId = requestId;
            latestRequestId = requestId;
            decryptionRequests[requestId] = msg.sender;
        }

        // Callback под актуальный API: 5 uint8 + подписи
    // Старый формат callback под 3-аргументный checkSignatures
        function resultsCallback(
            uint256 requestId,
            bytes memory cleartexts,
            bytes memory decryptionProof
        ) external returns (bool) {
            address player = decryptionRequests[requestId];
            require(player != address(0), "Invalid request ID");
            require(hasActiveGame[player], "No active game");

            GameData storage game = games[player];
            require(game.pendingRequestId == requestId, "Invalid pending request");

            // Проверка подписей старого API: 3 аргумента
            FHE.checkSignatures(requestId, cleartexts, decryptionProof);

            // Декодируем 5 значений uint8 из cleartexts
            (uint8 r0, uint8 r1, uint8 r2, uint8 r3, uint8 r4) =
                abi.decode(cleartexts, (uint8, uint8, uint8, uint8, uint8));

            uint8[WORD_LENGTH] memory results = [r0, r1, r2, r3, r4];

            bool isWin = true;
            for (uint8 i = 0; i < WORD_LENGTH; i++) {
                if (results[i] != 3) { isWin = false; break; }
            }

            game.pendingRequestId = 0;
            delete decryptionRequests[requestId];

            emit GuessEvaluated(player, game.currentAttempt - 1, results);

            if (isWin) {
                _completeGameForPlayer(player, GameStatus.Won);
            } else if (game.currentAttempt >= MAX_ATTEMPTS) {
                _completeGameForPlayer(player, GameStatus.Lost);
            }

            return isWin;
        }


        function getLastGuessResults() external view returns (uint8[WORD_LENGTH] memory) {
            require(testMode, "Use decryption oracle in prod mode");
            require(hasActiveGame[msg.sender], "No active game");

            GameData storage game = games[msg.sender];
            require(game.currentAttempt > 0, "No attempts made");

            uint8 lastAttempt = game.currentAttempt - 1;

            uint8[WORD_LENGTH] memory results;
            for (uint8 i = 0; i < WORD_LENGTH; i++) {
                results[i] = plainTextResults[msg.sender][lastAttempt][i];
            }
            return results;
        }

        // Возвращаем согласованную по типам матрицу [attempt][pos]
        function getAllGuessResults() external view returns (uint8[WORD_LENGTH][MAX_ATTEMPTS] memory) {
            require(testMode, "Use decryption oracle in prod mode");
            require(hasActiveGame[msg.sender], "No active game");

            uint8[WORD_LENGTH][MAX_ATTEMPTS] memory results;
            for (uint8 attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                for (uint8 pos = 0; pos < WORD_LENGTH; pos++) {
                    results[attempt][pos] = plainTextResults[msg.sender][attempt][pos];
                }
            }
            return results;
        }

        function _checkWinTestMode(uint8 attemptIndex) private {
            if (!testMode) return;

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
            return hasActiveGame[msg.sender]
                && games[msg.sender].status == GameStatus.InProgress
                && games[msg.sender].sessionHash == sessionHash
                && games[msg.sender].canRecover
                && block.timestamp <= games[msg.sender].startTime + GAME_TIMEOUT;
        }

        function _generateGameId() private view returns (uint256) {
            return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, totalGamesPlayed)));
        }

        function _selectRandomWord() private view returns (uint256) {
            uint256 randomSeed = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, block.prevrandao)));
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
            if (wordIndex == 0) { word = [8, 5, 12, 12, 15]; }
            else if (wordIndex == 1) { word = [23, 15, 18, 12, 4]; }
            else if (wordIndex == 2) { word = [8, 15, 21, 19, 5]; }
            else if (wordIndex == 3) { word = [13, 21, 19, 9, 3]; }
            else if (wordIndex == 4) { word = [2, 12, 1, 3, 11]; }
            else if (wordIndex == 5) { word = [7, 18, 5, 5, 14]; }
            else if (wordIndex == 6) { word = [16, 1, 16, 5, 18]; }
            else if (wordIndex == 7) { word = [20, 1, 2, 12, 5]; }
            else if (wordIndex == 8) { word = [12, 9, 7, 8, 20]; }
            else if (wordIndex == 9) { word = [23, 1, 20, 5, 18]; }

            return word;
        }

        function getPlayerStats(address player) external view returns (PlayerStats memory) {
            return playerStats[player];
        }

        function setTestMode(bool _testMode) external onlyOwner {
            testMode = _testMode;
        }

        function pauseGame(string calldata) external onlyOwner {
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
