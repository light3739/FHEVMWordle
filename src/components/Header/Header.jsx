import { BsBarChart, BsGear, BsInfoCircle, BsWallet, BsWalletFill } from 'react-icons/bs';
import './Header.module.scss';

const Header = ({
  setIsInfoModalOpen,
  setIsStatsModalOpen,
  setIsSettingsModalOpen,
  setIsWalletModalOpen,
  isWalletConnected,
}) => {
  return (
    <header>
      <div>
        <button onClick={() => setIsInfoModalOpen(true)}>
          <BsInfoCircle size="1.6rem" color="var(--color-icon)" />
        </button>
      </div>
      <h1>WORDLE</h1>
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
