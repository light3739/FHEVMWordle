import { useState, useEffect } from 'react';
import TutorialCard from '../TutorialCard';
import styles from './InteractiveTutorial.module.scss';

const InteractiveTutorial = () => {
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [completedCards, setCompletedCards] = useState(new Set());

  // Function to generate appropriate icons based on card type and content
  const generateIcon = (card) => {
    const iconMap = {
      'concept': '🧠',
      'setup': '⚙️',
      'installation': '📦',
      'code-heavy': '💻',
      'integration': '🔗',
      'deployment': '🚀',
      'faq': '❓'
    };
    
    // Special cases based on card ID or title
    const specialIcons = {
      'intro': '🔐', // FHEVM concept
      'libraries': '📚', // Installing libraries
      'contract': '📝', // Writing contracts
      'frontend': '⚛️', // React integration
      'deployment': '🌐', // Production deployment
      'faq': '🛠️' // Troubleshooting
    };
    
    const icon = specialIcons[card.id] || iconMap[card.type] || '📋';
    console.log(`Card ${card.id} (${card.type}) -> Icon: ${icon}`);
    return icon;
  };

  const tutorialCards = [
    {
      id: 'intro',
      title: 'What is FHEVM?',
      description: 'Understanding Fully Homomorphic Encryption in Blockchain',
      type: 'concept',
      content: {
        mainText: `Fully homomorphic encryption (FHE) lets smart contracts process data while it stays encrypted. In other words, computations can be performed on ciphertexts so that only the result (when decrypted) reveals the correct answer, without revealing the inputs.`,
        keyPoints: [
          '🔒 Data remains encrypted even during computations',
          '⚡ Solves blockchain\'s privacy problem',
          '🌐 All data on public ledger is visible by default',
          '🛡️ FHE keeps user data confidential during on-chain computation'
        ],
        highlight: 'This "holy grail" of cryptography solves blockchain\'s privacy problem!',
        imageExample: {
          src: '/image.avif',
          alt: 'FHEVM Architecture Diagram',
          caption: 'FHEVM enables computation on encrypted data while preserving privacy'
        }
      }
    },
    {
      id: 'setup',
      title: 'Environment Setup',
      description: 'Installing Node.js, Hardhat and React for development',
      type: 'setup',
      steps: [
        {
          title: 'Install Node.js',
          description: 'Begin by installing a supported Node.js LTS version',
          command: 'node --version',
          details: [
            'Use even-numbered version (e.g. v18 or v20)',
            'Check compatibility with your system',
            'Ensure npm is also installed'
          ]
        },
        {
          title: 'Initialize Project',
          description: 'Create a new project folder and initialize it',
          command: 'npm init',
          details: [
            'Create a new project folder',
            'Initialize project with npm init',
            'Follow instructions to create package.json'
          ]
        },
        {
          title: 'Install Hardhat and FHEVM',
          description: 'Install Hardhat and FHEVM plugin',
          command: 'npm install --save-dev hardhat @fhevm/hardhat-plugin',
          details: [
            'Hardhat - Ethereum development environment',
            '@fhevm/hardhat-plugin - plugin for FHEVM support',
            'These tools are essential for FHEVM work'
          ]
        }
      ],
      codeExample: `# Complete setup sequence
npm init
npm install --save-dev hardhat @fhevm/hardhat-plugin
npx hardhat init

# Create React frontend
npx create-react-app frontend
cd frontend
npm install ethers @zama-fhe/relayer-sdk

# Verify installation
npm run build
npm test`
    },
    {
      id: 'libraries',
      title: 'Installing FHEVM Libraries',
      description: 'Connecting Zama Solidity libraries and TFHE functions',
      type: 'installation',
      content: {
        mainText: 'Our contracts will use the Zama Solidity library and TFHE functions. Install the required dependencies:',
        installation: {
          command: 'npm install @fhevm/solidity',
          description: 'This provides Solidity contracts like FHE.sol and network configs.'
        },
        imports: {
          title: 'Imports in Solidity contracts',
          description: 'In your Solidity contract files, import the FHE library and network configuration:'
        }
      },
      codeExample: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import { FHE, euint8, euint32, externalEuint8 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract FHEWordle is SepoliaConfig {
    // Encrypted state (private word & mask)
    euint8[5] private secretLetters;  // five encrypted letters
    euint32 private secretMask;        // 26-bit mask of used letters
    
    // Public state
    bool public wordSet;
    bool public gameStarted;
    uint8 public nGuesses;
    
    // Store plaintext guesses and Merkle proofs for validity
    uint32[5] public guesses;
    bytes32 constant public rootAllowed = 0xABC...; // Merkle root of valid words
    
    // Event emitted when a guess is evaluated and decrypted
    event GuessEvaluated(uint8 indexed guessIndex, uint8 eqMask, uint32 letterMask);
}`
    },
    {
      id: 'contract',
      title: 'Writing Smart Contract',
      description: 'Creating game logic using FHEVM',
      type: 'code-heavy',
      content: {
        overview: 'Below is a simplified structure of our Wordle contract. We use euint8 for each secret letter (0–25 for a–z) and euint32 for a 26-bit mask.',
        keyFeatures: [
          '🔐 Private state stays encrypted',
          '📊 Public state or events reveal only allowed info',
          '🎯 Using masks for efficient letter checking',
          '⚡ Avoiding loops in encrypted logic'
        ]
      },
      functions: [
        {
          name: 'submitWord',
          description: 'Function for setting secret word (relayer only)',
          purpose: 'Allows privileged actor to encrypt and submit target word'
        },
        {
          name: 'guessWord',
          description: 'Function for recording player guess',
          purpose: 'Players submit guesses in plaintext with Merkle proof'
        },
        {
          name: 'evaluateGuess',
          description: 'Function for evaluating guess',
          purpose: 'Computes feedback without revealing secret'
        }
      ],
      codeExample: `function submitWord(euint8 l0, euint8 l1, euint8 l2, euint8 l3, euint8 l4) external onlyRelayer {
    require(!wordSet, "word already set");
    secretLetters[0] = l0;
    secretLetters[1] = l1;
    secretLetters[2] = l2;
    secretLetters[3] = l3;
    secretLetters[4] = l4;
    
    // Build a mask: for each letter l, set bit 1<<l
    secretMask = 
        TFHE.or(
            TFHE.shl(TFHE.asEuint32(1), secretLetters[0]),
            TFHE.or(
                TFHE.shl(TFHE.asEuint32(1), secretLetters[1]),
                TFHE.or(
                    TFHE.shl(TFHE.asEuint32(1), secretLetters[2]),
                    TFHE.or(
                        TFHE.shl(TFHE.asEuint32(1), secretLetters[3]),
                        TFHE.shl(TFHE.asEuint32(1), secretLetters[4])
                    )
                )
            )
        );
    wordSet = true;
    gameStarted = true;
}`
    },
    {
      id: 'frontend',
      title: 'Frontend Integration',
      description: 'Connecting React frontend to FHEVM smart contracts',
      type: 'integration',
      content: {
        mainText: 'In the React app, use ethers and Zama\'s Relayer SDK to interact:',
        setup: {
          title: 'Contract Setup',
          description: 'Create a function to set up contract connection'
        },
        features: [
          '🔗 Connect to wallet via MetaMask',
          '🔐 Encrypt input data using Relayer SDK',
          '📡 Send encrypted transactions',
          '👂 Listen to events for results'
        ]
      },
      codeExample: `import { ethers } from 'ethers';
import { FhevmRelayerProvider } from '@zama-fhe/relayer-sdk';
import FHEWordleABI from './artifacts/FHEWordle.json';

async function setupContract() {
  await window.ethereum.request({ method: 'eth_requestAccounts' });
  const provider = new ethers.providers.Web3Provider(window.ethereum);
  const signer = provider.getSigner();
  
  // RelayerProvider wraps signer to handle FHE inputs
  const relayer = new FhevmRelayerProvider(provider);
  const contractAddress = "<DEPLOYED_CONTRACT_ADDRESS>";
  const wordle = new ethers.Contract(contractAddress, FHEWordleABI, relayer);
  return wordle;
}

// Submit encrypted word
const letters = [16, 20, 8, 2, 10]; // "quick"
const input = await relayer.createEncryptedInput(wordle.address, await signer.getAddress());
letters.forEach(num => input.add8(num));
const { handles, inputProof } = await input.encrypt();

const tx = await wordle.submitWord(
  handles[0], handles[1], handles[2], handles[3], handles[4],
  inputProof
);
await tx.wait();`
    },
    {
      id: 'deployment',
      title: 'Production Deployment',
      description: 'Deploying your FHEVM application to production',
      type: 'deployment',
      content: {
        mainText: 'To deploy the project, use a script or Hardhat task.',
      steps: [
        {
            title: 'Network Setup',
            description: 'Ensure hardhat.config.js is configured for Sepolia',
            command: 'npx hardhat run scripts/deploy.js --network sepolia'
          },
          {
            title: 'Get Contract',
            description: 'Script typically prints the contract address',
            note: 'Save the address for use in frontend'
          },
          {
            title: 'Verify Deployment',
            description: 'Verify contract on Etherscan',
            command: 'npx hardhat verify --network sepolia <CONTRACT_ADDRESS>'
          }
        ]
      },
      codeExample: `// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const FHEWordle = await ethers.getContractFactory("FHEWordle");
  const wordle = await FHEWordle.deploy();
  
  await wordle.waitForDeployment();
  
  console.log("FHEWordle deployed to:", await wordle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
    },
    {
      id: 'faq',
      title: 'FAQ & Troubleshooting',
      description: 'Common issues and solutions for FHEVM development',
      type: 'faq',
      content: {
        mainText: 'Here are solutions for the most common problems when working with FHEVM:',
        problems: [
          {
            title: '🔗 Wallet/Network Issues',
            description: 'Make sure MetaMask is connected to the same network as the contract',
            solutions: [
              'For local testing use localhost:8545',
              'For real FHE use Sepolia',
              'Wrong chainId will cause transactions to fail'
            ]
          },
          {
            title: '⏱️ Long Decryption Delays',
            description: 'In Sepolia mode, oracle callbacks can take several minutes',
            solutions: [
              'Be patient after each guess',
              'Check event logs or GuessEvaluated event',
              'Don\'t rely on immediate return values'
            ]
          },
          {
            title: '💥 Smart Contract Reverts',
            description: 'Common gotchas include forgotten roles or mismatched parameter types',
            solutions: [
              'Check only onlyRelayer or onlyPlayer roles',
              'For encrypted inputs, ensure you pass correct proof',
              'Use Hardhat console logs or events for debugging'
            ]
          },
          {
            title: '🔄 Hardhat Mode vs Sepolia',
            description: 'If code works in Hardhat but not on Sepolia',
            solutions: [
              'Check that you added SepoliaConfig and imported FHE.sol',
              'Ensure you set Infura API key and mnemonic',
              'Hardhat mock mode doesn\'t catch network config issues'
            ]
          }
        ]
      },
      faq: [
        {
          question: 'How do I deploy this project?',
          answer: 'Use a script or Hardhat task to deploy. For example: npx hardhat run scripts/deploy.js --network sepolia'
        },
        {
          question: 'How to switch contract to production mode?',
          answer: 'When deploying on Sepolia, ensure hardhat.config.js sets chainId: 11155111 and uses SepoliaConfig.'
        }
      ]
    }
  ];

  const toggleCard = (cardId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
        // Mark card as completed when expanded
        setCompletedCards(prevCompleted => {
          const newCompleted = new Set(prevCompleted);
          newCompleted.add(cardId);
          return newCompleted;
        });
      }
      return newSet;
    });
  };

  // Calculate progress percentage
  const progressPercentage = (completedCards.size / tutorialCards.length) * 100;

  return (
    <div className={styles.tutorialContainer}>
      <div className={styles.tutorialContent}>
        {/* Header with progress and controls */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h1 className={styles.title}>🔐 FHEVM Wordle - Interactive Developer Tutorial</h1>
          </div>
          
        <p className={styles.subtitle}>
          Learn how to build privacy-preserving applications with Zama AI's FHEVM technology. 
          Click on any card below to see detailed step-by-step instructions.
        </p>

          {/* Progress Bar */}
          <div className={styles.progressSection}>
            <div className={styles.progressInfo}>
              <span className={styles.progressText}>
                Progress: {completedCards.size}/{tutorialCards.length} cards completed
              </span>
              <span className={styles.progressPercentage}>
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        
        <div className={styles.cardsGrid}>
          {tutorialCards.map((card) => (
            <TutorialCard
              key={card.id}
              {...card}
              icon={generateIcon(card)}
              isExpanded={expandedCards.has(card.id)}
              isCompleted={completedCards.has(card.id)}
              onToggle={toggleCard}
            />
          ))}
        </div>
        
        <div className={styles.footer}>
          <h3>🎯 Next Steps</h3>
          <p>
            Once you've completed these tutorials, you'll be ready to:
          </p>
          <ul>
            <li>🚀 Build your own FHEVM applications</li>
            <li>🤝 Contribute to the FHEVM Wordle project</li>
            <li>👥 Join the Zama AI developer community</li>
            <li>🌐 Deploy production-ready privacy-preserving dApps</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTutorial;
