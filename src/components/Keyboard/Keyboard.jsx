import { useEffect } from 'react';
import classNames from 'classnames';
import { getStatuses } from 'lib/words';
import styles from './Keyboard.module.scss';

const getStatusesFromContract = (guesses, contractResults) => {
  const charObj = {};
  
  guesses.forEach((word, guessIndex) => {
    const statuses = contractResults[guessIndex];
    if (statuses) {
      // Используем результаты от контракта
      word.split('').forEach((letter, i) => {
        const currentStatus = charObj[letter.toUpperCase()];
        const newStatus = statuses[i];
        
        // Приоритет: correct > present > absent
        if (newStatus === 'correct' || 
           (newStatus === 'present' && currentStatus !== 'correct') ||
           (newStatus === 'absent' && !currentStatus)) {
          charObj[letter.toUpperCase()] = newStatus;
        }
      });
    }
  });
  
  return charObj;
};

const Keyboard = ({ onEnter, onDelete, onKeyDown, guesses, isSubmittingWord, contractResults }) => {
  // Создаем статусы клавиш на основе результатов от контракта
  const charStatuses = getStatusesFromContract(guesses, contractResults);

  useEffect(() => {
    const listener = e => {
      if (isSubmittingWord) return; // Блокируем ввод во время отправки
      
      const key = e.key.toUpperCase();
      if (key === 'BACKSPACE') return onDelete();
      if (key === 'ENTER') return onEnter();
      if (key.length === 1 && key >= 'A' && key <= 'Z') onKeyDown(key);
    };

    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [isSubmittingWord, onDelete, onEnter, onKeyDown]);

  const handleClick = key => {
    if (isSubmittingWord) return; // Блокируем клики во время отправки
    
    if (key === 'ENTER') return onEnter();
    if (key === 'DELETE') return onDelete();

    onKeyDown(key);
  };

  return (
    <div className={classNames(styles.keyboard, { [styles.submitting]: isSubmittingWord })}>
      <div className={styles.row}>
        {['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(char => (
          <Key
            key={char}
            value={char}
            status={charStatuses[char]}
            onClick={handleClick}
          />
        ))}
      </div>
      <div className={styles.row}>
        {['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(char => (
          <Key
            key={char}
            value={char}
            status={charStatuses[char]}
            onClick={handleClick}
          />
        ))}
      </div>
      <div className={styles.row}>
        <Key value="DELETE" onClick={handleClick} status="action" />
        {['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(char => (
          <Key
            key={char}
            value={char}
            status={charStatuses[char]}
            onClick={handleClick}
          />
        ))}
        <Key value="ENTER" onClick={handleClick} status="action" />
      </div>
    </div>
  );
};

const Key = ({ value, status, onClick }) => {
  const classes = classNames({
    [styles.key]: true,
    [styles.absent]: status === 'absent',
    [styles.present]: status === 'present',
    [styles.correct]: status === 'correct',
    [styles.action]: status === 'action',
  });

  return (
    <button className={classes} onClick={() => onClick(value)}>
      {value}
    </button>
  );
};

export default Keyboard;
