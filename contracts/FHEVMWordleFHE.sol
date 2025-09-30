// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint8, externalEuint8, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { MerkleProof } from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract FHEVMWordleMerkle is SepoliaConfig {
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
        bool secretSet;
    }

    struct PlayerStats {
        uint256 totalGames;
        uint256 gamesWon;
        uint256 currentStreak;
        uint256 maxStreak;
        uint256[MAX_ATTEMPTS] winDistribution;
        uint256 bestTime;
    }

    // On-chain Merkle commitment
    bytes32 public merkleRoot;
    uint32 public merkleLeaves;

    // Encrypted game state
    mapping(address => GameData) public games;
    mapping(address => euint8[WORD_LENGTH]) private encryptedSecretWords;
    mapping(address => euint8[WORD_LENGTH][MAX_ATTEMPTS]) private encryptedGuesses;
    mapping(address => euint8[WORD_LENGTH][MAX_ATTEMPTS]) private encryptedResults;

    mapping(address => bool) public hasActiveGame;
    mapping(address => PlayerStats) public playerStats;
    mapping(address => uint256) public lastGameStartTime;
    mapping(uint256 => address) private decryptionRequests;

    address public owner;
    bool public isPaused;
    uint256 public totalGamesPlayed;
    uint256 public activeGamesCount;
    uint256 public totalPlayers;
    uint256 public latestRequestId;

    event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex);
    event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp);
    event GameCompleted(address indexed player, uint256 indexed gameId, GameStatus finalStatus, uint8 totalAttempts, uint256 duration, bool isWin);
    event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[WORD_LENGTH] results);
    event SecretWordSet(address indexed by, address indexed player, uint256 indexed wordIndex);

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier whenNotPaused() { require(!isPaused, "Game is paused"); _; }
    modifier rateLimited() { require(block.timestamp >= lastGameStartTime[msg.sender] + MIN_GAME_INTERVAL, "Too frequent"); _; }

    constructor(bytes32 _root, uint32 _leaves) {
        owner = msg.sender;
        merkleRoot = _root;
        merkleLeaves = _leaves;
        isPaused = false;
    }

    // Admin: set Merkle commitment
    function setMerkleRoot(bytes32 _root) external onlyOwner { merkleRoot = _root; }
    function setMerkleLeaves(uint32 _leaves) external onlyOwner { merkleLeaves = _leaves; }

    // Admin: set encrypted secret for a player
// замена функции в вашем контракте
// заменить вашу функцию на вариант без массива external-типов
    function setEncryptedSecretWord(
        address player,
        uint32 index,
        externalEuint8[WORD_LENGTH] calldata encryptedLetters, // Use an array
        bytes calldata inputProof,
        bytes32[] calldata merkleProof,
        bytes32 leaf
    ) external onlyOwner {
        // 1) Verify Merkle proof for the word
        require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid merkle proof");

        // 2) Convert and validate the entire array with a single inputProof
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            // The inputProof is validated internally by the FHE.fromExternal call.
            // The precompile understands it's for a batch and consumes it correctly on the first call.
            // For subsequent calls within the same transaction, it recognizes them as part of the same batch.
            encryptedSecretWords[player][i] = FHE.fromExternal(encryptedLetters[i], inputProof);
            FHE.allowThis(encryptedSecretWords[player][i]);
        }

        // 3) Record metadata
        games[player].secretSet = true;
        games[player].wordIndex = index;
        emit SecretWordSet(msg.sender, player, index);
    }
    event WordIndexChosen(address indexed player, uint32 index);

    // Player: start game
    function startGame(bytes32 sessionHash) external whenNotPaused rateLimited {
        GameData storage g = games[msg.sender];
        if (g.canRecover && g.sessionHash == sessionHash && block.timestamp <= g.startTime + GAME_TIMEOUT) {
            g.endTime = block.timestamp;
            emit GameStarted(msg.sender, g.gameId, sessionHash, block.timestamp, g.wordIndex);
            return;
        }
        if (hasActiveGame[msg.sender]) _completeGame(msg.sender, GameStatus.Abandoned);
        uint256 gameId = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, totalGamesPlayed)));
        g = games[msg.sender];
        g.gameId = gameId;
        g.player = msg.sender;
        g.currentAttempt = 0;
        g.status = GameStatus.InProgress;
        g.startTime = block.timestamp;
        g.endTime = 0;
        g.sessionHash = sessionHash;
        g.canRecover = true;
        g.pendingRequestId = 0;

        // NEW: псевдослучайный индекс на-чейне
        uint32 index = uint32(uint256(keccak256(abi.encodePacked(
            block.prevrandao, msg.sender, block.timestamp, totalGamesPlayed
        ))) % merkleLeaves);
        g.wordIndex = index;
        emit WordIndexChosen(msg.sender, index);

        hasActiveGame[msg.sender] = true;
        lastGameStartTime[msg.sender] = block.timestamp;
        activeGamesCount++;
        totalGamesPlayed++;
        if (playerStats[msg.sender].totalGames == 0) totalPlayers++;
        playerStats[msg.sender].totalGames++;
        emit GameStarted(msg.sender, gameId, sessionHash, block.timestamp, g.wordIndex);
    }

    // Player: submit encrypted guess
    function submitGuess(uint8[WORD_LENGTH] calldata guess) external whenNotPaused {
        GameData storage g = games[msg.sender];
        require(hasActiveGame[msg.sender], "No active game");
        require(g.status == GameStatus.InProgress, "Not in progress");
        require(g.currentAttempt < MAX_ATTEMPTS, "No attempts left");
        require(block.timestamp <= g.startTime + GAME_TIMEOUT, "Expired");
        require(g.secretSet, "Secret not set");
        uint8 ai = g.currentAttempt;
        for (uint8 i = 0; i < WORD_LENGTH; i++) {
            require(guess[i] >= 1 && guess[i] <= 26, "Invalid");
            encryptedGuesses[msg.sender][ai][i] = FHE.asEuint8(guess[i]);
            FHE.allowThis(encryptedGuesses[msg.sender][ai][i]);
        }
        _evaluateEncryptedGuess(ai);
        g.currentAttempt++;
        emit GuessSubmitted(msg.sender, g.gameId, ai, block.timestamp);
    }

    function _evaluateEncryptedGuess(uint8 ai) private {
        for (uint8 p = 0; p < WORD_LENGTH; p++) {
            euint8 gl = encryptedGuesses[msg.sender][ai][p];
            euint8 sl = encryptedSecretWords[msg.sender][p];
            ebool exact = FHE.eq(gl, sl);
            ebool present = FHE.asEbool(false);
            for (uint8 q = 0; q < WORD_LENGTH; q++) {
                if (q!=p) present = FHE.or(present, FHE.eq(gl, encryptedSecretWords[msg.sender][q]));
            }
            euint8 res = FHE.asEuint8(1);
            res = FHE.select(FHE.and(FHE.not(exact), present), FHE.asEuint8(2), res);
            res = FHE.select(exact, FHE.asEuint8(3), res);
            encryptedResults[msg.sender][ai][p] = res;
            FHE.allowThis(res);
        }
    }

    // Player: request async decrypt
    function requestDecryptResults() external {
        GameData storage g = games[msg.sender];
        require(hasActiveGame[msg.sender], "No active game");
        require(g.currentAttempt>0, "No attempts");
        require(g.pendingRequestId==0, "Pending");
        uint8 li = g.currentAttempt-1;
        bytes32[] memory cts = new bytes32[](WORD_LENGTH);
        for(uint8 i=0;i<WORD_LENGTH;i++) cts[i]=FHE.toBytes32(encryptedResults[msg.sender][li][i]);
        uint256 rid = FHE.requestDecryption(cts, this.resultsCallback.selector);
        g.pendingRequestId=rid;
        latestRequestId=rid;
        decryptionRequests[rid]=msg.sender;
    }

    function resultsCallback(uint256 rid, bytes memory clear, bytes memory proof) external returns (bool) {
        address p = decryptionRequests[rid];
        require(p!=address(0), "Invalid");
        GameData storage g = games[p];
        require(g.pendingRequestId==rid, "Mismatch");
        FHE.checkSignatures(rid, clear, proof);
        (uint8 r0,uint8 r1,uint8 r2,uint8 r3,uint8 r4)=abi.decode(clear,(uint8,uint8,uint8,uint8,uint8));
        uint8[WORD_LENGTH] memory res=[r0,r1,r2,r3,r4];
        bool win=true;
        for(uint8 i=0;i<WORD_LENGTH;i++) if(res[i]!=3) {win=false;break;}
        g.pendingRequestId=0;
        delete decryptionRequests[rid];
        emit GuessEvaluated(p, g.currentAttempt-1, res);
        if(win) _completeGame(p,GameStatus.Won);
        else if(g.currentAttempt>=MAX_ATTEMPTS) _completeGame(p,GameStatus.Lost);
        return win;
    }

    function _completeGame(address pl, GameStatus fs) private {
        GameData storage g=games[pl];
        PlayerStats storage s=playerStats[pl];
        g.status=fs; g.endTime=block.timestamp; g.canRecover=false; activeGamesCount--;
        uint256 dur=g.endTime-g.startTime; bool win=(fs==GameStatus.Won);
        if(win){
            s.gamesWon++; s.currentStreak++; if(s.currentStreak>s.maxStreak) s.maxStreak=s.currentStreak;
            if(g.currentAttempt>0) s.winDistribution[g.currentAttempt-1]++;
            if(s.bestTime==0||dur<s.bestTime) s.bestTime=dur;
        } else s.currentStreak=0;
        hasActiveGame[pl]=false;
        emit GameCompleted(pl,g.gameId,fs,uint8(g.currentAttempt),dur,win);
    }

    function pauseGame(string calldata) external onlyOwner { isPaused=true; }
    function unpauseGame() external onlyOwner { isPaused=false; }
    function forfeitGame() external { require(hasActiveGame[msg.sender],"No active"); _completeGame(msg.sender,GameStatus.Lost); }
}
