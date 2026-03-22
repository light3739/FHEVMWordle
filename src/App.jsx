import { useState, useEffect } from 'react';
import Header from 'components/Header';
import Grid from 'components/Grid';
import Keyboard from 'components/Keyboard';
import Alert from 'components/Alert';
import InfoModal from 'components/InfoModal';
import SettingModal from 'components/SettingModal';
import StatsModal from 'components/StatsModal';
import VictoryModal from 'components/VictoryModal';
import WalletModal from 'components/WalletModal';
import TutorialToggle from 'components/TutorialToggle';
import TutorialMode from 'components/TutorialMode';
import StartGameButton from 'components/StartGameButton';
import useLocalStorage from 'hooks/useLocalStorage';
import useAlert from 'hooks/useAlert';
import { getUniversalConnector } from 'hooks/useWallet';
import { BrowserProvider, Contract, ethers } from 'ethers';
import {
  initSDK,
  createInstance,
  SepoliaConfig,
} from '@zama-fhe/relayer-sdk/web';

import {
  solution,
  solutionIndex,
  isWordValid,
  findFirstUnusedReveal,
  addStatsForCompletedGame,
} from 'lib/words';
import {
  ALERT_DELAY,
  MAX_CHALLENGES,
  MAX_WORD_LENGTH,
} from 'constants/settings';
import styles from './App.module.scss';
import 'styles/_transitionStyles.scss';

// Контракт константы
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x...';
const CONTRACT_ABI = [
  // === MAIN GAME FUNCTIONS ===
  'function startGame(bytes32 sessionHash)',
  'function submitGuess(uint8[5] guess)',
  'function requestDecryptResults()',

  // === SECRET SETTING ===
  'function setEncryptedSecretWord(address player, uint32 index, bytes[] encryptedLetters, bytes inputProof, bytes32[] merkleProof, bytes32 leaf)',

  // ✅ ИСПРАВЛЕННАЯ СТРУКТУРА games() - ТОЧНО ПО КОНТРАКТУ:
  'function games(address) view returns (uint256 gameId, address player, uint8 currentAttempt, uint8 status, uint256 startTime, uint256 endTime, bytes32 sessionHash, uint256 wordIndex, bool canRecover, uint256 pendingRequestId, bool secretSet)',

  // === PAUSE MANAGEMENT ===
  'function pauseMyGame()',
  'function unpauseMyGame()',
  'function isPlayerPaused(address player) view returns (bool)',
  'function forfeitGame()',

  // === VIEW FUNCTIONS ===
  'function merkleRoot() view returns (bytes32)',
  'function merkleLeaves() view returns (uint32)',
  'function owner() view returns (address)',

  // === EVENTS ===
  'event GameStarted(address indexed player, uint256 indexed gameId, bytes32 sessionHash, uint256 timestamp, uint256 wordIndex)',
  'event GuessSubmitted(address indexed player, uint256 indexed gameId, uint8 attemptNumber, uint256 timestamp)',
  'event GameCompleted(address indexed player, uint256 indexed gameId, uint8 finalStatus, uint8 totalAttempts, uint256 duration, bool isWin)',
  'event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[5] results)',
  'event SecretWordSet(address indexed by, address indexed player, uint256 indexed wordIndex)',
  'event PlayerPaused(address indexed player)',
  'event PlayerUnpaused(address indexed player)',
  'event WordIndexChosen(address indexed player, uint32 index)',
];


const RPC_SEPOLIA = process.env.REACT_APP_RPC_SEPOLIA;

function App() {
  const [isSettingSecret, setIsSettingSecret] = useState(false);
  const [wordsMeta, setWordsMeta] = useState(null);
  const [isSecretReady, setIsSecretReady] = useState(false);
  const [fheInstance, setFheInstance] = useState(null);
  const [universalConnector, setUniversalConnector] = useState();
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem('walletSession');
      return stored ? JSON.parse(stored) : undefined;
    } catch {
      return undefined;
    }
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [savedGameInfo, setSavedGameInfo] = useState(null);
  const [isCheckingForSavedGame, setIsCheckingForSavedGame] = useState(false);
  const { showAlert } = useAlert();

  useEffect(() => {
    const init = async () => {
      if (session && !fheInstance) {
        try {
          showAlert('Initializing FHE engine...', 'info');

          // Initialize WASM modules (v0.4.1)
          // thread: 1 disables multi-threaded WASM pool (avoids SES lockdown + browser crashes)
          await initSDK({ thread: 1 });

          // Create FHE instance with SepoliaConfig (relayer.testnet.zama.org)
          // Use dedicated Sepolia RPC (not window.ethereum which may be on wrong network)
          const config = {
            ...SepoliaConfig,
            network: RPC_SEPOLIA || 'https://sepolia.infura.io/v3/17d9c7c455364415a1d9186f7774517e',
          };
          const instance = await createInstance(config);

          setFheInstance(instance);
          showAlert('FHE engine ready!', 'success');
          console.log('FHE instance created:', instance);
        } catch (e) {
          console.error('Failed to initialize FHE:', e);
          showAlert('Failed to initialize FHE engine: ' + e.message, 'error');
        }
      }
    };

    init();
  }, [session, fheInstance, showAlert]);
  useEffect(() => {
    if (session && universalConnector && wordsMeta) {
      window.testMerkle = async () => {
        try {
          const provider = await universalConnector.connect();
          const ethersProvider = new BrowserProvider(provider);
          const signer = await ethersProvider.getSigner();
          const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

          const playerAddress = session.address;
          const gameState = await contract.games(playerAddress);
          const actualIndex = Number(gameState.wordIndex);
          const item = wordsMeta.items[actualIndex];

          console.log('=== DIAGNOSTIC: TESTING MERKLE VERIFICATION ===');
          console.log('Contract Address:', CONTRACT_ADDRESS);
          console.log('Player Address:', playerAddress);
          console.log('Actual Word Index (from contract):', actualIndex);

          if (!item) {
            console.error('❌ Word index', actualIndex, 'not found in wordsMeta.items');
            return;
          }

          console.log('Item Word:', item.word);
          console.log('Item Leaf:', item.leaf);
          console.log('Item Proof:', item.proof);

          const contractRoot = await contract.merkleRoot();
          console.log('Contract Root:', contractRoot);
          console.log('WordsMeta Root:', wordsMeta.root);

          // We try a static call to see if it reverts
          try {
            console.log('Executing staticCall for setEncryptedSecretWord...');
            // Using dummy handles for Merkle check (handles are not checked against leaf content in this contract)
            const dummyHandles = Array(5).fill(ethers.AbiCoder.defaultAbiCoder().encode(['(bytes32)'], [[ethers.ZeroHash]]));
            const dummyProof = '0x';

            await contract.setEncryptedSecretWord.staticCall(
              playerAddress,
              actualIndex,
              dummyHandles,
              dummyProof,
              item.proof,
              item.leaf
            );
            console.log('✅ STATIC CALL PASSED (Merkle proof is valid!)');
            alert('✅ Merkle proof is valid!');
          } catch (error) {
            console.error('❌ STATIC CALL FAILED:', error);
            if (error.data) console.error('Error data:', error.data);
            alert('❌ Merkle verification failed: ' + (error.reason || error.message));
          }
        } catch (e) {
          console.error('Diagnostic error:', e);
        }
      };
    }
  }, [session, universalConnector, wordsMeta]);

  async function setSecretOnchainForSelf(index) {
    showAlert('Setting secret with real FHE data...', 'info');

    if (isSettingSecret) return;
    setIsSettingSecret(true);

    try {
      if (!session || !universalConnector) {
        showAlert('Connect wallet first', 'error');
        return;
      }
      if (!fheInstance) {
        showAlert('FHE engine is not ready yet.', 'error');
        return;
      }
      if (!wordsMeta) {
        showAlert('Dictionary not loaded', 'error');
        return;
      }

      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const signerAddress = await signer.getAddress();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      const contractAddress = await contract.getAddress();

      if (session.address.toLowerCase() !== signerAddress.toLowerCase()) {
        throw new Error(
          `Wallet/session mismatch: session=${session.address}, signer=${signerAddress}`
        );
      }

      const playerAddress = signerAddress;

      const gameState = await contract.games(playerAddress);
      if (gameState.gameId.toString() === '0') {
        showAlert('No active game found. Please start a game first.', 'error');
        return;
      }

      if (gameState.secretSet) {
        showAlert('Secret already set for this game!', 'warning');
        setIsSecretReady(true);
        return;
      }

      const actualIndex = parseInt(gameState.wordIndex.toString(), 10);
      const item = wordsMeta.items[actualIndex];

      if (!item) {
        throw new Error(`Index ${actualIndex} out of range in words.json`);
      }

      const contractRoot = await contract.merkleRoot();
      if (contractRoot !== wordsMeta.root) {
        showAlert('❌ ROOT MISMATCH! Old file cached!', 'error');
        return;
      }

      const letters = item.word
        .toUpperCase()
        .split('')
        .map(ch => ch.charCodeAt(0) - 64);

      const input = fheInstance.createEncryptedInput(
        contractAddress,
        playerAddress
      );

      letters.forEach(letter => input.add8(letter));

      const { handles, inputProof } = await input.encrypt();

      const encodedHandles = handles.map(handle =>
        ethers.AbiCoder.defaultAbiCoder().encode(['(bytes32)'], [[handle]])
      );

      const tx = await contract.setEncryptedSecretWord(
        playerAddress,
        actualIndex,
        encodedHandles,
        inputProof,
        item.proof,
        item.leaf,
        { gasLimit: 8000000 }
      );

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        showAlert('✅ Secret set successfully!', 'success');
        setIsSecretReady(true);
      } else {
        throw new Error('Transaction execution reverted');
      }
    } catch (e) {
      console.error('setSecretOnchainForSelf error:', e);
      let msg = e.message || 'Failed to set secret';
      if (e.data) msg += ` (Data: ${e.data.slice(0, 10)}...)`;
      showAlert(msg, 'error');
    } finally {
      setIsSettingSecret(false);
    }
  }

  const [blockAutoReconnect, setBlockAutoReconnect] = useState(false);
  const [boardState, setBoardState] = useLocalStorage('boardState', {
    guesses: [],
    solutionIndex: '',
  });
  const [theme, setTheme] = useLocalStorage('theme', 'dark');
  const [highContrast, setHighContrast] = useLocalStorage(
    'high-contrast',
    false
  );
  const [hardMode, setHardMode] = useLocalStorage('hard-mode', false);
  const [stats, setStats] = useLocalStorage('gameStats', {
    winDistribution: Array.from(new Array(MAX_CHALLENGES), () => 0),
    gamesFailed: 0,
    currentStreak: 0,
    bestStreak: 0,
    totalGames: 0,
    successRate: 0,
  });
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState(() => {
    if (boardState.solutionIndex !== solutionIndex) return [];
    return boardState.guesses;
  });
  const [isJiggling, setIsJiggling] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [isGameLost, setIsGameLost] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isVictoryModalOpen, setIsVictoryModalOpen] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHardMode, setIsHardMode] = useState(hardMode);
  const [isDarkMode, setIsDarkMode] = useState(theme === 'dark');
  const [isHighContrastMode, setIsHighContrastMode] = useState(highContrast);
  const [isTutorialMode, setIsTutorialMode] = useState(true); // Начинаем с туториала
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isSubmittingWord, setIsSubmittingWord] = useState(false);
  const [waitingForDecryption, setWaitingForDecryption] = useState(false);
  const [contractResults, setContractResults] = useLocalStorage(
    'contractResults',
    {}
  );
  const [, setCurrentSessionHash] = useLocalStorage(
    'currentSessionHash',
    null
  );

  // Загрузка словаря words.json
  useEffect(() => {
    (async () => {
      try {
        const WORDS_URL = 'https://fhevm-wordle.vercel.app/dist/words.json';
        const res = await fetch(WORDS_URL);
        const meta = await res.json();
        setWordsMeta(meta);
      } catch (e) {
        console.error('Failed to load words.json', e);
        showAlert('Failed to load words.json', 'error');
      }
    })();
  }, [showAlert]);

  // Ensure Sepolia network (chainId 11155111)
  const ensureSepolia = async provider => {
    const targetHex = '0xaa36a7';
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetHex }],
      });
    } catch (err) {
      if (err?.code === 4902) {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: targetHex,
              chainName: 'Sepolia',
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: [RPC_SEPOLIA],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            },
          ],
        });
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetHex }],
        });
      } else {
        throw err;
      }
    }
  };
  // Wallet state

  // Open wallet modal if no session; close if session exists
  useEffect(() => {
    if (!session) setIsWalletModalOpen(true);
    else setIsWalletModalOpen(false);
  }, [session, boardState.solutionIndex]);

  // Show info modal after wallet connection
  useEffect(() => {
    if (session && !boardState.solutionIndex) {
      setTimeout(() => setIsInfoModalOpen(true), 500);
    }
  }, [session, boardState.solutionIndex]);

  // Check for saved games when wallet connects
  useEffect(() => {
    if (session && universalConnector && !isGameStarted) {
      checkForSavedGame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, universalConnector, isGameStarted]);

  // Initialize Universal Connector
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const uc = await getUniversalConnector();
        if (mounted) setUniversalConnector(uc);
      } catch (e) {
        console.error('Wallet init failed', e);
        showAlert('Wallet init failed', 'error');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [showAlert]);
  useEffect(() => {
    if (!universalConnector || blockAutoReconnect) return;
    (async () => {
      try {
        if (!universalConnector.cachedProvider) return;

        const provider = await universalConnector.connect();
        const ethersProvider = new BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const address = await signer.getAddress();
        const { chainId } = await ethersProvider.getNetwork();
        const newSession = { address, chainId };

        setSession(newSession);
        try {
          localStorage.setItem('walletSession', JSON.stringify(newSession));
        } catch { }
      } catch {
        setSession(undefined);
      }
    })();
  }, [universalConnector, blockAutoReconnect]);
  const [isPlayerPaused, setIsPlayerPaused] = useState(false);
  useEffect(() => {
    const checkPauseStatus = async () => {
      if (!session || !universalConnector) return;

      try {
        const provider = await universalConnector.connect();
        const ethersProvider = new BrowserProvider(provider);
        const signer = await ethersProvider.getSigner();
        const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

        const isPaused = await contract.isPlayerPaused(session.address);
        setIsPlayerPaused(isPaused);
      } catch (e) {
        console.error('Failed to check pause status:', e);
      }
    };

    if (isGameStarted) {
      checkPauseStatus();
      const interval = setInterval(checkPauseStatus, 10000); // Проверяем каждые 10 секунд
      return () => clearInterval(interval);
    }
  }, [session, universalConnector, isGameStarted]);

  // Save boardState to localStorage
  useEffect(() => {
    setBoardState({
      guesses,
      solutionIndex,
    });
    // eslint-disable-next-line
  }, [guesses]);

  useEffect(() => {
    if (!isTutorialMode) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isTutorialMode]);

  // Check game winning or losing
  useEffect(() => {
    if (guesses.includes(solution.toUpperCase())) {
      setIsGameWon(true);
      setTimeout(() => showAlert('Well done', 'success'), ALERT_DELAY);
      setTimeout(() => setIsVictoryModalOpen(true), ALERT_DELAY + 1000);
      // Очищаем sessionHash после победы
      setCurrentSessionHash(null);
      setSavedGameInfo(null);
    } else if (guesses.length === MAX_CHALLENGES) {
      setIsGameLost(true);
      setTimeout(
        () => showAlert(`The word was ${solution}`, 'error', true),
        ALERT_DELAY
      );
      setTimeout(() => setIsStatsModalOpen(true), ALERT_DELAY + 1000);
      // Очищаем sessionHash после поражения
      setCurrentSessionHash(null);
      setSavedGameInfo(null);
    }
    // eslint-disable-next-line
  }, [guesses]);

  // Handle wallet connection
  useEffect(() => {
    if (isWalletModalOpen) document.body.setAttribute('data-wallet', 'open');
    else document.body.removeAttribute('data-wallet');
  }, [isWalletModalOpen]);

  useEffect(() => {
    if (isDarkMode) document.body.setAttribute('data-theme', 'dark');
    else document.body.removeAttribute('data-theme');

    if (isHighContrastMode)
      document.body.setAttribute('data-mode', 'high-contrast');
    else document.body.removeAttribute('data-mode');
  }, [isDarkMode, isHighContrastMode]);
  // (legacy handlers removed; using new handlers below)

  // Wallet connect/disconnect
  const handleConnectWallet = async () => {
    if (!universalConnector) {
      showAlert('Wallet not ready', 'error');
      return;
    }
    setIsConnecting(true);
    try {
      const provider = await (universalConnector.connect?.() ||
        Promise.reject(new Error('Connect not available')));

      // 1) Принудительный свитч сети на Sepolia
      await ensureSepolia(provider);

      // 2) Оборачиваем в ethers v6
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      const { chainId } = await ethersProvider.getNetwork();
      if (chainId !== 11155111) {
        showAlert('Please switch to Sepolia network in your wallet', 'warning');
      }

      // Сохраняем сессию независимо от сети
      const newSession = { address, chainId };
      setSession(newSession);
      try {
        localStorage.setItem('walletSession', JSON.stringify(newSession));
        localStorage.setItem('userAddress', address);
        localStorage.setItem('selectedNetwork', String(chainId));
      } catch { }

      setIsWalletModalOpen(false);
      setBlockAutoReconnect(false);
      showAlert('Wallet connected', 'success');
    } catch (e) {
      console.error('Connect failed', e);
      showAlert(e?.message || 'Wallet connect failed', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = async () => {
    // Блокируем автоподключение в этом цикле жизни
    setBlockAutoReconnect(true);

    try {
      // Разрываем соединение и чистим кэш провайдера в Web3Modal
      await universalConnector?.disconnect?.();
      await universalConnector?.clearCachedProvider?.();
    } catch (e) {
      console.warn('Disconnect issue', e);
    }

    // Чистим штатный ключ Web3Modal v1 (на всякий случай)
    try {
      localStorage.removeItem('WEB3_CONNECT_CACHED_PROVIDER');
    } catch { }

    // Чистим вашу сессию
    setSession(undefined);
    try {
      localStorage.removeItem('walletSession');
    } catch { }

    // Очистка игрового ввода/состояния
    setCurrentGuess('');
    setGuesses([]);
    setIsJiggling(false);
    setIsGameWon(false);
    setIsGameLost(false);
    setIsGameStarted(false);
    setIsStartingGame(false);
    setIsSubmittingWord(false);
    setWaitingForDecryption(false);
    setContractResults({});
    setCurrentSessionHash(null);
    setSavedGameInfo(null);
    setBoardState({ guesses: [], solutionIndex });

    try {
      localStorage.removeItem('selectedNetwork');
      localStorage.removeItem('userAddress');
      localStorage.removeItem('userProfile');
      sessionStorage.clear();
    } catch { }
    setIsWalletModalOpen(false);
    showAlert('Wallet disconnected', 'success');
  };

  const handleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    setTheme(isDarkMode ? 'light' : 'dark');
  };

  const handleHighContrastMode = () => {
    setIsHighContrastMode(!isHighContrastMode);
    setHighContrast(!isHighContrastMode);
  };

  const handleHardMode = () => {
    setIsHardMode(!isHardMode);
    setHardMode(!isHardMode);
  };

  const handleTutorialToggle = () => {
    setIsTutorialMode(!isTutorialMode);
  };

  const checkForSavedGame = async () => {
    if (!session || !universalConnector) {
      setSavedGameInfo(null);
      return;
    }

    setIsCheckingForSavedGame(true);
    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      // Новый способ: читаем games(address)
      const game = await contract.games(session.address);
      // вычисляем timeRemaining и hasExpired на клиенте
      const currentTime = Math.floor(Date.now() / 1000);
      const timeElapsed = currentTime - Number(game.startTime);
      const timeRemaining = Number(game.GAME_TIMEOUT) - timeElapsed;
      let gameAge = '';
      if (timeElapsed < 60) {
        gameAge = 'just now';
      } else if (timeElapsed < 3600) {
        gameAge = `${Math.floor(timeElapsed / 60)} minutes ago`;
      } else {
        gameAge = `${Math.floor(timeElapsed / 3600)} hours ago`;
      }
      // hasExpired: если timeRemaining <= 0 или game.hasExpired
      const hasExpired = timeRemaining <= 0 || game.hasExpired;
      if (game.canRecover && !hasExpired) {
        setSavedGameInfo({
          exists: true,
          canRecover: game.canRecover,
          currentAttempt: Number(game.currentAttempt),
          gameAge,
          timeRemaining,
          sessionHash: game.sessionHash,
        });
      } else {
        setSavedGameInfo(null);
      }
    } catch (error) {
      console.error('Failed to check for saved game:', error);
      setSavedGameInfo(null);
    } finally {
      setIsCheckingForSavedGame(false);
    }
  };

  const handleStartNewGameFromVictory = async () => {
    setIsVictoryModalOpen(false);
    await handleStartGame(true);
  };

  const handleContinueGame = async () => {
    if (!savedGameInfo || !session || !universalConnector) {
      showAlert('No saved game found', 'error');
      return;
    }

    setIsStartingGame(true);
    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      // Новый способ: читаем games(address)
      const game = await contract.games(session.address);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeElapsed = currentTime - Number(game.startTime);
      const timeRemaining = Number(game.GAME_TIMEOUT) - timeElapsed;
      const hasExpired = timeRemaining <= 0 || game.hasExpired;
      if (!game.canRecover || hasExpired) {
        showAlert('Saved game is no longer available', 'error');
        setSavedGameInfo(null);
        return;
      }
      const currentAttempt = Number(game.currentAttempt);
      // Восстанавливаем попытки из localStorage
      let restoredGuesses = [];
      try {
        const savedGuesses = boardState.guesses || [];
        if (savedGuesses.length >= currentAttempt) {
          restoredGuesses = savedGuesses.slice(0, currentAttempt);
        } else {
          restoredGuesses = [...savedGuesses];
          while (restoredGuesses.length < currentAttempt) {
            restoredGuesses.push('');
          }
        }
      } catch {
        restoredGuesses = Array(currentAttempt).fill('');
      }
      setGuesses(restoredGuesses);
      setIsGameStarted(true);
      setSavedGameInfo(null);
      showAlert(
        `Game restored! Continuing from attempt ${currentAttempt + 1}`,
        'success'
      );
    } catch (error) {
      console.error('Failed to continue game:', error);
      showAlert('Failed to continue game', 'error');
    } finally {
      setIsStartingGame(false);
    }
  };

  const handleStartGame = async (forceNew = false) => {
    if (!session) {
      showAlert('Please connect your wallet first', 'error');
      return;
    }

    if (!universalConnector) {
      showAlert('Wallet not ready', 'error');
      return;
    }

    if (forceNew) {
      setCurrentGuess('');
      setGuesses([]);
      setIsJiggling(false);
      setIsGameWon(false);
      setIsGameLost(false);
      setContractResults({});
      setCurrentSessionHash(null);
      setSavedGameInfo(null);
      setBoardState({ guesses: [], solutionIndex });
      setIsSecretReady(false);
    }

    setIsStartingGame(true);
    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const sessionHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${session.address}-${Date.now()}-${Math.random()}`)
      );

      setCurrentSessionHash(sessionHash);
      showAlert('Starting game...', 'info');

      const tx = await contract.startGame(sessionHash);
      showAlert('Transaction sent! Waiting for confirmation...', 'info');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setIsGameStarted(true);
        showAlert('Game started successfully!', 'success');

        // ✅ ИСПРАВЛЕНИЕ: Получаем wordIndex из gameState
        try {
          showAlert('Getting word index...', 'info');

          // Получаем обновленное состояние игры
          const gameState = await contract.games(session.address);
          const wordIndex = Number(gameState.wordIndex);

          console.log('Game state:', gameState);
          console.log('Word index from gameState:', wordIndex);

          if (Number.isInteger(wordIndex) && wordIndex >= 0) {
            showAlert('Auto-setting secret word...', 'info');

            // ✅ АВТОМАТИЧЕСКИ УСТАНАВЛИВАЕМ СЕКРЕТ:
            await setSecretOnchainForSelf(wordIndex);
          } else {
            showAlert('Failed to get word index from game state', 'error');
            console.error('Invalid wordIndex:', wordIndex, typeof wordIndex);
          }
        } catch (e) {
          console.error('Auto set secret error:', e);
          showAlert('Failed to auto-set secret: ' + e.message, 'error');
        }
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      let errorMessage = 'Failed to start game';

      if (error.code === 'INSUFFICIENT_FUNDS') {
        errorMessage = 'Insufficient funds for gas';
      } else if (error.code === 'USER_REJECTED') {
        errorMessage = 'Transaction rejected by user';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert(errorMessage, 'error');
    } finally {
      setIsStartingGame(false);
    }
  };

  const waitForDecryptionResults = async (
    contract,
    playerAddress,
    fromBlock
  ) => {
    const INITIAL_WAIT_TIME = 2 * 60 * 1000; // 2 минуты
    const POLL_INTERVAL = 5000; // Проверяем каждые 5 секунд
    const startTime = Date.now();
    let attempts = 0;
    let notificationShown = false;

    return new Promise((resolve, reject) => {
      const checkForResults = async () => {
        try {
          attempts++;
          const elapsedTime = Date.now() - startTime;

          // Показываем уведомление через 2 минуты, но продолжаем ждать
          if (elapsedTime > INITIAL_WAIT_TIME && !notificationShown) {
            notificationShown = true;
            showAlert(
              'Decryption is taking longer than usual. This usually means Zama services might be experiencing issues. You can wait for the result or try starting a new game later.',
              'warning'
            );
          }

          // Показываем прогресс каждые 30 секунд после первых 2 минут
          if (elapsedTime > INITIAL_WAIT_TIME && attempts % 6 === 0) {
            const elapsedMinutes = Math.floor(elapsedTime / 60000);
            showAlert(
              `Still waiting for decryption... ${elapsedMinutes} minutes elapsed`,
              'info'
            );
          }

          // Ищем события GuessEvaluated для данного игрока
          const filter = contract.filters.GuessEvaluated(playerAddress);
          const events = await contract.queryFilter(filter, fromBlock);

          if (events.length > 0) {
            // Берем последнее событие
            const latestEvent = events[events.length - 1];
            const results = latestEvent.args.results.map(Number);
            resolve(results);
            return;
          }

          // Продолжаем ждать бесконечно (или до тех пор, пока пользователь не начнет новую игру)
          setTimeout(checkForResults, POLL_INTERVAL);
        } catch (error) {
          console.error('Error while waiting for results:', error);
          reject(error);
        }
      };

      // Начинаем проверку
      checkForResults();
    });
  };
  // Добавьте эту функцию в компонент:
  const handleForfeitGame = async () => {
    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.forfeitGame();
      showAlert('Forfeiting game...', 'info');
      await tx.wait();
      showAlert('Game forfeited!', 'info');

      // Сбросить состояние игры
      setIsGameStarted(false);
      setGuesses([]);
      setCurrentGuess('');
      setIsSecretReady(false);
    } catch (e) {
      showAlert('Failed to forfeit game: ' + e.message, 'error');
    }
  };

  const submitWordToContract = async word => {
    if (!session || !universalConnector) {
      throw new Error('Wallet not connected');
    }

    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const wordToNums = w => {
        return Array.from(w.toUpperCase()).map(char => char.charCodeAt(0) - 64);
      };

      const guessArray = wordToNums(word);

      showAlert('Submitting word...', 'info');

      const tx = await contract.submitGuess(guessArray);
      showAlert('Word submitted! Processing...', 'info');

      const receipt = await tx.wait();

      if (receipt.status !== 1) {
        throw new Error('Transaction failed');
      }

      showAlert('Requesting decryption...', 'info');
      const decryptTx = await contract.requestDecryptResults();
      const decryptReceipt = await decryptTx.wait();

      if (decryptReceipt.status !== 1) {
        throw new Error('Decryption request failed');
      }

      showAlert('Waiting for decryption results...', 'info');
      setWaitingForDecryption(true);

      const results = await waitForDecryptionResults(
        contract,
        session.address,
        decryptReceipt.blockNumber
      );

      if (results) {
        await processGuessResults(word, results);
        showAlert('Results received!', 'success');
      }
    } catch (error) {
      console.error('Contract interaction failed:', error);
      throw error;
    }
  };

  const processGuessResults = async (word, results) => {
    console.log(`=== PROCESSING GUESS RESULTS ===`);
    console.log(`Word: ${word}`);
    console.log(`Raw results from contract:`, results);

    const statuses = results.map(result => {
      switch (result) {
        case 1:
          return 'absent';
        case 2:
          return 'present';
        case 3:
          return 'correct';
        default:
          return 'absent';
      }
    });

    console.log(`Converted statuses:`, statuses);
    console.log(`Current guesses length:`, guesses.length);

    const guessIndex = guesses.length;
    console.log(`Saving results for guess index:`, guessIndex);

    setContractResults(prev => {
      const updated = {
        ...prev,
        [guessIndex]: statuses,
      };
      console.log(`Updated contractResults:`, updated);
      return updated;
    });

    const isWin = results.every(result => result === 3);
    if (isWin) {
      setIsGameWon(true);
      showAlert('Congratulations! You won!', 'success');
      setTimeout(() => setIsVictoryModalOpen(true), 1000);
      setStats(addStatsForCompletedGame(stats, guesses.length + 1));
      // Очищаем sessionHash после победы
      setCurrentSessionHash(null);
      setSavedGameInfo(null);
      return;
    }

    if (guesses.length + 1 >= MAX_CHALLENGES) {
      setIsGameLost(true);
      showAlert(`Game over! The word was: ${solution}`, 'error');
      setStats(addStatsForCompletedGame(stats, guesses.length + 1));
      // Очищаем sessionHash после поражения
      setCurrentSessionHash(null);
      setSavedGameInfo(null);
    }
  };

  const handleKeyDown = letter =>
    currentGuess.length < MAX_WORD_LENGTH &&
    !isGameWon &&
    !isSubmittingWord &&
    !waitingForDecryption &&
    setCurrentGuess(currentGuess + letter);

  const handleDelete = () =>
    !isSubmittingWord &&
    !waitingForDecryption &&
    setCurrentGuess(currentGuess.slice(0, currentGuess.length - 1));

  const handleEnter = async () => {
    if (isGameWon || isGameLost || isSubmittingWord || waitingForDecryption)
      return;
    if (!isSecretReady) {
      showAlert('Secret not set yet', 'warning');
      return;
    }

    if (currentGuess.length < MAX_WORD_LENGTH) {
      setIsJiggling(true);
      return showAlert('Not enough letters', 'error');
    }

    if (!isWordValid(currentGuess)) {
      setIsJiggling(true);
      return showAlert('Not in word list', 'error');
    }

    if (isHardMode) {
      const firstMissingReveal = findFirstUnusedReveal(currentGuess, guesses);
      if (firstMissingReveal) {
        setIsJiggling(true);
        return showAlert(firstMissingReveal, 'error');
      }
    }

    setIsSubmittingWord(true);

    try {
      await submitWordToContract(currentGuess);

      setGuesses([...guesses, currentGuess]);
      setCurrentGuess('');

      if (currentGuess === solution.toUpperCase()) {
        setStats(addStatsForCompletedGame(stats, guesses.length + 1));
      } else if (guesses.length + 1 === MAX_CHALLENGES) {
        setStats(addStatsForCompletedGame(stats, guesses.length + 1));
      }
    } catch (error) {
      console.error('Failed to submit word:', error);
      showAlert('Failed to submit word', 'error');
    } finally {
      setIsSubmittingWord(false);
      setWaitingForDecryption(false);
    }
  };

  return (
    <div className={styles.container}>
      <Header
        setIsInfoModalOpen={setIsInfoModalOpen}
        setIsStatsModalOpen={setIsStatsModalOpen}
        setIsSettingsModalOpen={setIsSettingsModalOpen}
        setIsWalletModalOpen={setIsWalletModalOpen}
        isWalletConnected={!!session}
      />
      <TutorialToggle
        isTutorialMode={isTutorialMode}
        onToggle={handleTutorialToggle}
      />
      <Alert />

      {isTutorialMode ? (
        <TutorialMode />
      ) : !isGameStarted ? (
        <>
          <StartGameButton
            onStartGame={() => handleStartGame(true)}
            onContinueGame={handleContinueGame}
            isLoading={isStartingGame || isCheckingForSavedGame}
            hasSavedGame={savedGameInfo?.exists && savedGameInfo?.canRecover}
            savedGuesses={savedGameInfo?.currentAttempt || 0}
            gameAge={savedGameInfo?.gameAge || ''}
          />
        </>
      ) : (
        <>
          {/* ✅ БЛОК УПРАВЛЕНИЯ ИГРОЙ */}
          <div
            style={{
              margin: '12px 0',
              textAlign: 'center',
              padding: '8px',
              backgroundColor: isDarkMode ? '#262626' : '#f8f9fa',
              borderRadius: '8px',
              border: `1px solid ${isDarkMode ? '#3a3a3c' : '#d3d6da'}`,
            }}
          >
            {/* ✅ СТАТУС СЕКРЕТА - ПОКАЗЫВАЕТ ПРОГРЕСС */}
            {isSecretReady ? (
              <div
                style={{
                  color: '#6aaa64',
                  fontSize: '14px',
                  margin: '4px 0',
                }}
              >
                ✅ Secret word is ready! Start guessing!
              </div>
            ) : isSettingSecret ? (
              <div
                style={{
                  color: '#f59e0b',
                  fontSize: '14px',
                  margin: '4px 0',
                }}
              >
                🎲 Auto-setting your secret word...
              </div>
            ) : (
              <div
                style={{
                  color: '#787c7e',
                  fontSize: '14px',
                  margin: '4px 0',
                }}
              >
                🔄 Preparing game...
              </div>
            )}

            {/* Кнопки управления паузой */}
            <div style={{ margin: '8px 0' }}>
              <button
                onClick={async () => {
                  try {
                    const provider = await universalConnector.connect();
                    const ethersProvider = new BrowserProvider(provider);
                    const signer = await ethersProvider.getSigner();
                    const contract = new Contract(
                      CONTRACT_ADDRESS,
                      CONTRACT_ABI,
                      signer
                    );

                    const isPaused = await contract.isPlayerPaused(
                      session.address
                    );

                    if (isPaused) {
                      const tx = await contract.unpauseMyGame();
                      showAlert('Unpausing game...', 'info');
                      await tx.wait();
                      showAlert('Game unpaused!', 'success');
                      setIsPlayerPaused(false);
                    } else {
                      const tx = await contract.pauseMyGame();
                      showAlert('Pausing game...', 'info');
                      await tx.wait();
                      showAlert('Game paused!', 'info');
                      setIsPlayerPaused(true);
                    }
                  } catch (e) {
                    showAlert('Failed to toggle pause: ' + e.message, 'error');
                  }
                }}
                disabled={!isSecretReady}
                style={{
                  padding: '8px 16px',
                  margin: '0 4px',
                  backgroundColor: !isSecretReady
                    ? '#787c7e'
                    : isPlayerPaused
                      ? '#f59e0b'
                      : '#6aaa64',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !isSecretReady ? 'not-allowed' : 'pointer',
                  opacity: !isSecretReady ? 0.6 : 1,
                }}
              >
                {isPlayerPaused ? '▶️ Unpause Game' : '⏸️ Pause Game'}
              </button>

              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Are you sure you want to forfeit this game?'
                    )
                  ) {
                    handleForfeitGame();
                  }
                }}
                style={{
                  padding: '8px 16px',
                  margin: '0 4px',
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                🏳️ Forfeit Game
              </button>
            </div>

            {/* ✅ РАСШИРЕННЫЙ ИНДИКАТОР СОСТОЯНИЯ ИГРЫ */}
            <div
              style={{
                fontSize: '12px',
                color: isDarkMode ? '#d7dadc' : '#6e6e73',
                margin: '4px 0',
              }}
            >
              {isSettingSecret && '🎲 Setting up secret word...'}
              {!isSecretReady && !isSettingSecret && '⏳ Game preparing...'}
              {isPlayerPaused && '⏸️ Game is paused'}
              {waitingForDecryption && '🔄 Waiting for decryption...'}
              {isSubmittingWord && '📤 Submitting word...'}
              {isSecretReady &&
                !isPlayerPaused &&
                !waitingForDecryption &&
                !isSubmittingWord &&
                '🎮 Ready to play!'}
            </div>
          </div>

          {/* Основной игровой интерфейс */}
          <Grid
            currentGuess={currentGuess}
            guesses={guesses}
            isJiggling={isJiggling}
            setIsJiggling={setIsJiggling}
            isSubmittingWord={
              isSubmittingWord ||
              waitingForDecryption ||
              isPlayerPaused ||
              !isSecretReady
            }
            contractResults={contractResults}
          />
          <Keyboard
            onEnter={handleEnter}
            onDelete={handleDelete}
            onKeyDown={handleKeyDown}
            guesses={guesses}
            isSubmittingWord={
              isSubmittingWord ||
              waitingForDecryption ||
              isPlayerPaused ||
              !isSecretReady
            }
            contractResults={contractResults}
          />
        </>
      )}

      <InfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
      />
      <SettingModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isHardMode={isHardMode}
        isDarkMode={isDarkMode}
        isHighContrastMode={isHighContrastMode}
        setIsHardMode={handleHardMode}
        setIsDarkMode={handleDarkMode}
        setIsHighContrastMode={handleHighContrastMode}
      />
      <StatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        gameStats={stats}
        numberOfGuessesMade={guesses.length}
        isGameWon={isGameWon}
        isGameLost={isGameLost}
        isHardMode={isHardMode}
        guesses={guesses}
        showAlert={showAlert}
      />
      <VictoryModal
        isOpen={isVictoryModalOpen}
        onClose={() => setIsVictoryModalOpen(false)}
        onStartNewGame={handleStartNewGameFromVictory}
        numberOfGuesses={guesses.length}
      />
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        universalConnector={universalConnector}
        isConnecting={isConnecting}
        session={session}
        onConnect={handleConnectWallet}
        onDisconnect={handleDisconnectWallet}
      />
    </div>
  );
}

export default App;
