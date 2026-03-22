import { useEffect } from 'react';
import classNames from 'classnames';
import Cell from 'components/Cell';
import { getGuessStatuses } from 'lib/words';
import { MAX_CHALLENGES, MAX_WORD_LENGTH } from 'constants/settings';
import styles from './Grid.module.scss';

const Grid = ({ currentGuess, guesses, isJiggling, setIsJiggling, isSubmittingWord, contractResults }) => {
  const empties =
    MAX_CHALLENGES > guesses.length
      ? Array(MAX_CHALLENGES - guesses.length - 1).fill()
      : [];

  useEffect(() => {
    setTimeout(() => {
      if (isJiggling) setIsJiggling(false);
    }, 500);
    // eslint-disable-next-line
  }, [isJiggling]);

  return (
    <div className={styles.grid}>
      {guesses.map((guess, i) => (
        <CompletedRow key={i} guess={guess} contractResults={contractResults[i]} />
      ))}
      {guesses.length < MAX_CHALLENGES && (
        <CurrentRow guess={currentGuess} isJiggling={isJiggling} isSubmittingWord={isSubmittingWord} />
      )}
      {empties.map((_, i) => (
        <EmptyRow key={i} />
      ))}
    </div>
  );
};

const CurrentRow = ({ guess, isJiggling, isSubmittingWord }) => {
  const emptyCells = Array(MAX_WORD_LENGTH - guess.length).fill('');
  const cells = [...guess, ...emptyCells];

  const classes = classNames({
    [styles.row]: true,
    [styles.jiggle]: isJiggling,
    [styles.submitting]: isSubmittingWord,
  });

  return (
    <div className={classes}>
      {cells.map((letter, index) => (
        <Cell key={index} value={letter} isSubmitting={isSubmittingWord} />
      ))}
    </div>
  );
};

const CompletedRow = ({ guess, contractResults }) => {
  const cells = guess.split('');
  // Используем результаты от контракта если они есть, иначе пустой массив
  const statuses = contractResults || Array(MAX_WORD_LENGTH).fill('');

  return (
    <div className={styles.row}>
      {cells.map((letter, index) => (
        <Cell
          key={index}
          position={index}
          value={letter}
          isCompleted
          status={statuses[index]}
        />
      ))}
    </div>
  );
};

const EmptyRow = () => {
  const cells = Array(MAX_WORD_LENGTH).fill();

  return (
    <div className={styles.row}>
      {cells.map((_, index) => (
        <Cell key={index} />
      ))}
    </div>
  );
};

export default Grid;
