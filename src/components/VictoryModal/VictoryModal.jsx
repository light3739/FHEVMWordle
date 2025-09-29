import Modal from 'components/Modal';
import styles from './VictoryModal.module.scss';

const VictoryModal = ({
  isOpen,
  onClose,
  onStartNewGame,
  numberOfGuesses
}) => {
  const handleStartNewGame = () => {
    onStartNewGame();
    onClose();
  };

  const handleSendFeedback = () => {
    // Простая декоративная кнопка без функционала
    onClose();
  };

  return (
    <Modal title="🎉 Victory!" isOpen={isOpen} onClose={onClose}>
      <div className={styles.container}>
        <div className={styles.message}>
          <h2>Congratulations!</h2>
          <p>You solved the puzzle in {numberOfGuesses} {numberOfGuesses === 1 ? 'guess' : 'guesses'}!</p>
        </div>
        
        <div className={styles.buttons}>
          <button 
            className={styles.startNewGameButton}
            onClick={handleStartNewGame}
          >
            🎮 Start New Game
          </button>
          
          <button 
            className={styles.sendFeedbackButton}
            onClick={handleSendFeedback}
          >
            💭 Send Feedback
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default VictoryModal;
