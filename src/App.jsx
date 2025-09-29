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
  'function startGame(bytes32 sessionHash)',
  'function submitGuess(uint8[5] guess)',
  'function requestDecryptResults()',
  'function getGameState(bytes32 sessionHash) view returns (bool exists, bool canRecover, uint256 gameId, uint8 status, uint8 currentAttempt, uint256 startTime, uint256 timeRemaining, bool hasExpired)',
  'function getLastGuessResults() view returns (uint8[5])',
  'event GuessEvaluated(address indexed player, uint8 attemptNumber, uint8[5] results)',
];

function App() {
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
  const [currentSessionHash, setCurrentSessionHash] = useLocalStorage(
    'currentSessionHash',
    null
  );
  const [savedGameInfo, setSavedGameInfo] = useState(null);
  const [isCheckingForSavedGame, setIsCheckingForSavedGame] = useState(false);
  const { showAlert } = useAlert();
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
              rpcUrls: [
                'https://sepolia.infura.io/v3/17d9c7c455364415a1d9186f7774517e',
              ],
              nativeCurrency: {
                name: 'SepoliaETH',
                symbol: 'ETH',
                decimals: 18,
              },
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
        } catch {}
      } catch {
        setSession(undefined);
      }
    })();
  }, [universalConnector, blockAutoReconnect]);

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
      } catch {}

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
    } catch {}

    // Чистим вашу сессию
    setSession(undefined);
    try {
      localStorage.removeItem('walletSession');
    } catch {}

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
    } catch {}
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

    // Если нет сохранённого sessionHash, значит нет активной игры
    if (!currentSessionHash) {
      setSavedGameInfo(null);
      return;
    }

    setIsCheckingForSavedGame(true);
    try {
      const provider = await universalConnector.connect();
      const ethersProvider = new BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();

      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const gameState = await contract.getGameState(currentSessionHash);
      console.log('Game state:', gameState);

      if (gameState.exists && gameState.canRecover && !gameState.hasExpired) {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeElapsed = currentTime - Number(gameState.startTime);
        const timeRemaining = Number(gameState.timeRemaining);

        let gameAge = '';
        if (timeElapsed < 60) {
          gameAge = 'just now';
        } else if (timeElapsed < 3600) {
          gameAge = `${Math.floor(timeElapsed / 60)} minutes ago`;
        } else {
          gameAge = `${Math.floor(timeElapsed / 3600)} hours ago`;
        }

        setSavedGameInfo({
          exists: true,
          canRecover: gameState.canRecover,
          currentAttempt: Number(gameState.currentAttempt),
          gameAge,
          timeRemaining,
          sessionHash: currentSessionHash,
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

      // Проверяем актуальное состояние игры
      const gameState = await contract.getGameState(savedGameInfo.sessionHash);

      if (!gameState.exists || !gameState.canRecover || gameState.hasExpired) {
        showAlert('Saved game is no longer available', 'error');
        setSavedGameInfo(null);
        return;
      }

      // Восстанавливаем состояние игры
      const currentAttempt = Number(gameState.currentAttempt);

      // Пытаемся восстановить сохранённые попытки из localStorage
      let restoredGuesses = [];
      try {
        const savedGuesses = boardState.guesses || [];
        if (savedGuesses.length >= currentAttempt) {
          restoredGuesses = savedGuesses.slice(0, currentAttempt);
        } else {
          // Дополняем недостающие попытки пустыми строками
          restoredGuesses = [...savedGuesses];
          while (restoredGuesses.length < currentAttempt) {
            restoredGuesses.push(''); // Пустые слова для неизвестных попыток
          }
        }
      } catch {
        // Если не удалось восстановить, создаем массив пустых попыток
        restoredGuesses = Array(currentAttempt).fill('');
      }

      // Восстанавливаем состояние
      setGuesses(restoredGuesses);
      setIsGameStarted(true);
      setSavedGameInfo(null); // Очищаем информацию о сохранённой игре

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

      // Сохраняем sessionHash для возможности восстановления игры
      setCurrentSessionHash(sessionHash);

      showAlert('Starting game...', 'info');

      const tx = await contract.startGame(sessionHash);
      showAlert('Transaction sent! Waiting for confirmation...', 'info');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setIsGameStarted(true);
        showAlert('Game started successfully!', 'success');
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
        <StartGameButton
          onStartGame={() => handleStartGame(true)}
          onContinueGame={handleContinueGame}
          isLoading={isStartingGame || isCheckingForSavedGame}
          hasSavedGame={savedGameInfo?.exists && savedGameInfo?.canRecover}
          savedGuesses={savedGameInfo?.currentAttempt || 0}
          gameAge={savedGameInfo?.gameAge || ''}
        />
      ) : (
        <>
          <Grid
            currentGuess={currentGuess}
            guesses={guesses}
            isJiggling={isJiggling}
            setIsJiggling={setIsJiggling}
            isSubmittingWord={isSubmittingWord || waitingForDecryption}
            contractResults={contractResults}
          />
          <Keyboard
            onEnter={handleEnter}
            onDelete={handleDelete}
            onKeyDown={handleKeyDown}
            guesses={guesses}
            isSubmittingWord={isSubmittingWord || waitingForDecryption}
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
