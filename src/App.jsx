import { useState, useEffect } from 'react';
import Header from 'components/Header';
import Grid from 'components/Grid';
import Keyboard from 'components/Keyboard';
import Alert from 'components/Alert';
import InfoModal from 'components/InfoModal';
import SettingModal from 'components/SettingModal';
import StatsModal from 'components/StatsModal';
import WalletModal from 'components/WalletModal';
import useLocalStorage from 'hooks/useLocalStorage';
import useAlert from 'hooks/useAlert';
import { getUniversalConnector } from 'hooks/useWallet';
import { BrowserProvider } from 'ethers';

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
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isHardMode, setIsHardMode] = useState(hardMode);
  const [isDarkMode, setIsDarkMode] = useState(theme === 'dark');
  const [isHighContrastMode, setIsHighContrastMode] = useState(highContrast);
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

  // Check game winning or losing
  useEffect(() => {
    if (guesses.includes(solution.toUpperCase())) {
      setIsGameWon(true);
      setTimeout(() => showAlert('Well done', 'success'), ALERT_DELAY);
      setTimeout(() => setIsStatsModalOpen(true), ALERT_DELAY + 1000);
    } else if (guesses.length === MAX_CHALLENGES) {
      setIsGameLost(true);
      setTimeout(
        () => showAlert(`The word was ${solution}`, 'error', true),
        ALERT_DELAY
      );
      setTimeout(() => setIsStatsModalOpen(true), ALERT_DELAY + 1000);
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

  const handleKeyDown = letter =>
    currentGuess.length < MAX_WORD_LENGTH &&
    !isGameWon &&
    setCurrentGuess(currentGuess + letter);

  const handleDelete = () =>
    setCurrentGuess(currentGuess.slice(0, currentGuess.length - 1));

  const handleEnter = () => {
    if (isGameWon || isGameLost) return;

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

    if (currentGuess === solution.toUpperCase()) {
      setStats(addStatsForCompletedGame(stats, guesses.length));
    } else if (guesses.length + 1 === MAX_CHALLENGES) {
      setStats(addStatsForCompletedGame(stats, guesses.length + 1));
    }

    setGuesses([...guesses, currentGuess]);
    setCurrentGuess('');
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
      <Alert />
      <Grid
        currentGuess={currentGuess}
        guesses={guesses}
        isJiggling={isJiggling}
        setIsJiggling={setIsJiggling}
      />
      <Keyboard
        onEnter={handleEnter}
        onDelete={handleDelete}
        onKeyDown={handleKeyDown}
        guesses={guesses}
      />
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
