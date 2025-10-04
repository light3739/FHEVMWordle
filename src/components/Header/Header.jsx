import {
  BsBarChart,
  BsGear,
  BsInfoCircle,
  BsWallet,
  BsWalletFill,
  BsBook,
} from 'react-icons/bs';
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
      <div className="title-container" style={{ paddingLeft: '85px' }}>
        <h1>WORDLE/ZAMA</h1>
      </div>
      <div>
        <button 
          className="tutorial-button"
          onClick={() => window.open('https://gist.github.com/light3739/1798e7f82f5fa95b2817c412e9687a32', '_blank')}
          title="View Tutorial"
        >
          <BsBook size="1.6rem" color="white" />
        </button>
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
