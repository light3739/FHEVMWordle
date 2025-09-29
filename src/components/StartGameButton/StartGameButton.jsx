import styles from './StartGameButton.module.scss';

const StartGameButton = ({ onStartGame, onContinueGame, isLoading, hasSavedGame, savedGuesses, gameAge }) => {
  return (
    <div className={styles.startGameContainer}>
      <div className={styles.startGameContent}>
        <h2 className={styles.title}>Ready to Play?</h2>
        <p className={styles.description}>
          Connect your wallet and start a new FHEVM Wordle game!
        </p>
        <div className={styles.buttonsContainer}>
          <button 
            className={styles.startButton}
            onClick={onStartGame}
            disabled={isLoading}
          >
            {isLoading ? 'Starting Game...' : 'Start New Game'}
          </button>
          
          {hasSavedGame && (
            <button 
              className={styles.continueButton}
              onClick={onContinueGame}
              disabled={isLoading}
            >
              Continue Game ({savedGuesses}/6)
            </button>
          )}
        </div>
        
        {hasSavedGame && gameAge && (
          <p className={styles.gameInfo}>
            Last played {gameAge}
          </p>
        )}
      </div>
    </div>
  );
};

export default StartGameButton;
