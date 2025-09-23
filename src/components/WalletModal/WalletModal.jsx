import classNames from 'classnames';
import { useRef } from 'react';
import styles from './WalletModal.module.scss';

const WalletModal = ({ isOpen, onClose }) => {
  const ref = useRef();

  const classes = classNames({
    [styles.modal]: true,
    [styles.isOpen]: isOpen,
  });

  return (
    <div
      className={classes}
      ref={ref}
      onClick={e => {
        if (e.target === ref.current) {
          onClose();
        }
      }}
    ></div>
  );
};

export default WalletModal;
