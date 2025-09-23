import classNames from 'classnames';
import { useRef } from 'react';
import styles from './WalletModal.module.scss';
import { createAppKit } from '@reown/appkit'
import { mainnet, arbitrum } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
const WalletModal = ({
  isOpen,
  onClose,
  isConnecting,
  session,
  onConnect,
  onDisconnect,
}) => {
  const ref = useRef();

  const classes = classNames({
    [styles.modal]: true,
    [styles.isOpen]: isOpen,
  });

  const stop = e => {
    // Prevent closing when clicking inside content
    e.stopPropagation();
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
            <button onClick={onDisconnect}>Disconnect</button>
          </div>
        ) : (
          <div className={styles.section}>
            <button onClick={onConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletModal;
