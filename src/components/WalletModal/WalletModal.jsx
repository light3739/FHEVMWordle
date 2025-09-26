import classNames from 'classnames';
import { useRef, useState } from 'react';
import styles from './WalletModal.module.scss';
import { providers } from 'ethers';

const WalletModal = ({
  isOpen,
  onClose,
  isConnecting,
  universalConnector,
  session,
  onConnect,
  onDisconnect,
}) => {
  const ref = useRef();
  const [connecting, setConnecting] = useState(false);

  const classes = classNames({
    [styles.modal]: true,
    [styles.isOpen]: isOpen,
  });

  const stop = e => {
    e.stopPropagation();
  };

  const handleConnect = async () => {
    if (!universalConnector) {
      alert('Wallet not ready');
      return;
    }
    try {
      setConnecting(true);
      const provider = await universalConnector.connect();
      const ethersProvider = new providers.Web3Provider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      const sess = { address, provider, signer };
      if (onConnect) onConnect(sess);
    } catch (e) {
      // silently ignore cancel or handle error
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    onClose();
    try {
      await universalConnector?.disconnect?.();
    } catch {}
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
        {session ? (
          <div className={styles.section}>
            <div className={styles.row}>
              <span>Status:</span>
              <strong>Connected</strong>
            </div>
            {session.address && (
              <div className={styles.row}>
                <span>Address:</span>
                <code>{session.address}</code>
              </div>
            )}
            <button
              className={`${styles.button} ${styles.buttonDeclined}`}
              onClick={handleDisconnect}
              disabled={isConnecting || connecting}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className={styles.actions}>
            <button
              className={styles.button}
              onClick={handleConnect}
              disabled={isConnecting || connecting || !universalConnector}
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
