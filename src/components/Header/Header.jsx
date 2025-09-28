import { BsBarChart, BsGear, BsInfoCircle, BsWallet, BsWalletFill } from 'react-icons/bs';
import './Header.module.scss';

const Header = ({
  setIsInfoModalOpen,
  setIsStatsModalOpen,
  setIsSettingsModalOpen,
  setIsWalletModalOpen,
  isWalletConnected,
  progressInfo,
}) => {
  return (
    <header>
      <div className="left-section">
        {progressInfo && (
          <div className="progress-info">
            <span className="progress-text">{progressInfo}</span>
          </div>
        )}
        <button onClick={() => setIsInfoModalOpen(true)}>
          <BsInfoCircle size="1.6rem" color="var(--color-icon)" />
        </button>
      </div>
      <div className="title-container">
        <h1>WORDLE/ZAMA</h1>
      </div>
      <div>
        <button onClick={() => setIsStatsModalOpen(true)}>
          <BsBarChart size="1.6rem" color="var(--color-icon)" />
        </button>
        <button onClick={() => setIsSettingsModalOpen(true)}>
          <BsGear size="1.6rem" color="var(--color-icon)" />
        </button>
        <button onClick={() => setIsWalletModalOpen(true)}>
          {isWalletConnected ? (
            <BsWalletFill size="1.6rem" color="var(--color-correct)" />
          ) : (
            <BsWallet size="1.6rem" color="var(--color-icon)" />
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;
