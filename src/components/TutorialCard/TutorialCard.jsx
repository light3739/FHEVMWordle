import { useState } from 'react';
import classNames from 'classnames';
import styles from './TutorialCard.module.scss';

const TutorialCard = ({ 
  id, 
  title, 
  description, 
  icon, 
  steps, 
  codeExample, 
  isExpanded, 
  onToggle 
}) => {
  const [showCode, setShowCode] = useState(false);

  const handleToggle = () => {
    onToggle(id);
  };

  const cardClasses = classNames({
    [styles.card]: true,
    [styles.expanded]: isExpanded,
  });

  const getIcon = () => {
    switch (icon) {
      case 'rocket':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.5C12 2.5 2 4 2 14C2 16.5 3.5 18 6 18C7.5 18 8.5 17 9.5 16C10 15.5 10.5 15 11 14.5C11.2 14.3 11.4 14.2 11.6 14.1C11.8 14 12 14 12.2 14.1C12.4 14.2 12.6 14.3 12.8 14.5C13.3 15 13.8 15.5 14.3 16C15.3 17 16.3 18 17.8 18C20.3 18 21.8 16.5 21.8 14C21.8 4 12 2.5 12 2.5Z" fill="currentColor"/>
            <path d="M12 6C13.1 6 14 6.9 14 8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8C10 6.9 10.9 6 12 6Z" fill="currentColor"/>
          </svg>
        );
      case 'shield':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 7C13.4 7 14.8 7.6 15.7 8.9L17 7.6C15.8 5.8 14 5 12 5C10 5 8.2 5.8 7 7.6L8.3 8.9C9.2 7.6 10.6 7 12 7ZM12 9C10.9 9 10 9.9 10 11C10 12.1 10.9 13 12 13C13.1 13 14 12.1 14 11C14 9.9 13.1 9 12 9Z" fill="currentColor"/>
          </svg>
        );
      case 'code':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 13.5L10.5 15.5L15.5 10.5L10.5 5.5L8.5 7.5L11.5 10.5L8.5 13.5Z" fill="currentColor"/>
            <path d="M15.5 13.5L13.5 15.5L8.5 10.5L13.5 5.5L15.5 7.5L12.5 10.5L15.5 13.5Z" fill="currentColor"/>
            <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V6H20V18Z" fill="currentColor"/>
          </svg>
        );
      case 'gear':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.67 19.18 11.36 19.14 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.35C19.24 5.13 19.01 5.03 18.79 5.08L16.38 5.64C16.05 5.29 15.68 4.97 15.28 4.7L14.87 2.28C14.83 2.05 14.64 1.88 14.41 1.88H9.59C9.36 1.88 9.17 2.05 9.13 2.28L8.72 4.7C8.32 4.97 7.95 5.29 7.62 5.64L5.21 5.08C4.99 5.03 4.76 5.13 4.64 5.35L2.72 8.87C2.61 9.07 2.66 9.34 2.84 9.48L4.86 11.06C4.82 11.36 4.8 11.67 4.8 12C4.8 12.33 4.82 12.64 4.86 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.65C4.76 18.87 4.99 18.97 5.21 18.92L7.62 18.36C7.95 18.71 8.32 19.03 8.72 19.3L9.13 21.72C9.17 21.95 9.36 22.12 9.59 22.12H14.41C14.64 22.12 14.83 21.95 14.87 21.72L15.28 19.3C15.68 19.03 16.05 18.71 16.38 18.36L18.79 18.92C19.01 18.97 19.24 18.87 19.36 18.65L21.28 15.13C21.39 14.93 21.34 14.66 21.16 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z" fill="currentColor"/>
          </svg>
        );
      case 'terminal':
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V6H20V18ZM6 8H8V10H6V8ZM10 8H18V10H10V8ZM6 12H8V14H6V12ZM10 12H18V14H10V12ZM6 16H8V18H6V16ZM10 16H18V18H10V16Z" fill="currentColor"/>
          </svg>
        );
      default:
        return (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2ZM18 20H6V4H13V9H18V20ZM8 12H16V14H8V12ZM8 16H13V18H8V16Z" fill="currentColor"/>
          </svg>
        );
    }
  };

  return (
    <div className={cardClasses}>
      <div className={styles.cardHeader} onClick={handleToggle}>
        <div className={styles.cardIcon}>
          {getIcon()}
        </div>
        <div className={styles.cardInfo}>
          <h3 className={styles.cardTitle}>{title}</h3>
          <p className={styles.cardDescription}>{description}</p>
        </div>
        <div className={styles.cardToggle}>
          <span className={styles.toggleIcon}>
            {isExpanded ? '−' : '+'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.cardContent}>
          <div className={styles.steps}>
            {steps.map((step, index) => (
              <div key={index} className={styles.step}>
                <div className={styles.stepHeader}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <h4 className={styles.stepTitle}>{step.title}</h4>
                </div>
                <p className={styles.stepDescription}>{step.description}</p>
                
                {step.command && (
                  <div className={styles.commandBlock}>
                    <span className={styles.commandLabel}>Command:</span>
                    <code className={styles.command}>{step.command}</code>
                  </div>
                )}
                
                {step.details && step.details.length > 0 && (
                  <ul className={styles.stepDetails}>
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className={styles.stepDetail}>
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {codeExample && (
            <div className={styles.codeSection}>
              <div className={styles.codeHeader}>
                <span className={styles.codeTitle}>Code Example</span>
                <button 
                  className={styles.codeToggle}
                  onClick={() => setShowCode(!showCode)}
                >
                  {showCode ? 'Hide Code' : 'Show Code'}
                </button>
              </div>
              
              {showCode && (
                <pre className={styles.codeBlock}>
                  <code className={styles.code}>{codeExample}</code>
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TutorialCard;
