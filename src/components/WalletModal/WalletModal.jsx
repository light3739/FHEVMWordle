import classNames from 'classnames';
import { useMemo, useRef, useState, useEffect } from 'react';
import styles from './WalletModal.module.scss';
import Web3Modal from 'web3modal';
import { providers } from 'ethers';
const WalletModal = ({
  isOpen,
  onClose,
  isConnecting,
  session,
  onConnect,
  onDisconnect,
}) => {
  const ref = useRef();
  const [connecting, setConnecting] = useState(false);
  const [localSession, setLocalSession] = useState(null);
  const effectiveSession = session || localSession;

  const web3Modal = useMemo(() => {
    return new Web3Modal({ cacheProvider: false, providerOptions: {} });
  }, []);

  const classes = classNames({
    [styles.modal]: true,
    [styles.isOpen]: isOpen,
  });

  const stop = e => {
    // Prevent closing when clicking inside content
    e.stopPropagation();
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const provider = await web3Modal.connect();
      const ethersProvider = new providers.Web3Provider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      const sess = { address, provider, signer };
      setLocalSession(sess);
      if (onConnect) onConnect(sess);
    } catch (e) {
      // silently ignore cancel
      // console.error('Web3Modal connect error', e)
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const p = effectiveSession?.provider;
      await p?.disconnect?.();
    } catch {}
    try {
      await web3Modal.clearCachedProvider?.();
    } catch {}
    setLocalSession(null);
    if (onDisconnect) onDisconnect();
  };

  return (
    <div
      className={classes}
      ref={ref}
      onClick={e => {
        if (e.target === ref.current) {
          onClose();
        }
      }}
    >
      <div className={styles.content} onClick={stop}>
        <h2>Wallet</h2>
        {effectiveSession ? (
          <div className={styles.section}>
            <div className={styles.row}>
              <span>Status:</span>
              <strong>Connected</strong>
            </div>
            {effectiveSession.address && (
              <div className={styles.row}>
                <span>Address:</span>
                <code>{effectiveSession.address}</code>
              </div>
            )}
            <button
              className={`${styles.button} ${styles.buttonDeclined}`}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={handleConnect}
              disabled={isConnecting || connecting}
            >
              {isConnecting || connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletModal;
