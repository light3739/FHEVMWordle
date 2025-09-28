import classNames from 'classnames';
import styles from './TutorialToggle.module.scss';

const TutorialToggle = ({ isTutorialMode, onToggle }) => {
  const classes = classNames({
    [styles.toggle]: true,
    [styles.tutorialMode]: isTutorialMode, // Возвращаем обратно
  });

  return (
    <div className={styles.toggleContainer}>
      <div className={styles.labels}>
        <span className={isTutorialMode ? styles.active : styles.inactive}>
          Tutorial
        </span>
        <span className={!isTutorialMode ? styles.active : styles.inactive}>
          Game
        </span>
      </div>
      <div className={classes} onClick={onToggle}>
        <div className={styles.slider}>
          <div className={styles.knob} />
        </div>
      </div>
    </div>
  );
};

export default TutorialToggle;
