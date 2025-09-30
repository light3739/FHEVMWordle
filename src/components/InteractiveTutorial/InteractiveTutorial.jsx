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
      title: 'What Makes FHEVM Wordle Special?',
      description: 'The first fully confidential on-chain Wordle game',
      type: 'concept',
      content: {
        mainText: `FHEVM Wordle is **the first fully confidential on-chain Wordle game** built with Fully Homomorphic Encryption. The secret word is encrypted on the blockchain, and your smart contract verifies guesses **without ever decrypting the secret**!`,
        comparison: {
          title: 'Traditional vs FHEVM Wordle',
          traditional: [
            'Secret: "HELLO"',
            'Storage: Client',
            'Validation: JavaScript',
            'Trust: Required'
          ],
          fhevm: [
            'Secret: euint8[5] (encrypted)',
            'Storage: Blockchain',
            'Validation: Smart Contract',
            'Trust: Zero (cryptographically proven)'
          ]
        },
        keyPoints: [
          '🔐 Secret word stored encrypted on-chain',
          '🧮 Homomorphic operations: FHE.eq(), FHE.or(), FHE.select()',
          '🔓 Async decryption with callback pattern',
          '📊 Batch processing: decrypt 5 letters in one request',
          '⚡ Gas optimization: ~25,000 gas saved per game'
        ],
        highlight: 'This "holy grail" of cryptography solves blockchain\'s privacy problem!'
      }
    },
    {
      id: 'setup',
      title: 'Quick Start Setup',
      description: 'Get FHEVM Wordle running in minutes',
      type: 'setup',
      prerequisites: {
        title: 'Prerequisites',
        items: [
          'node >= 16.0.0',
          'npm >= 8.0.0',
          'MetaMask or compatible Web3 wallet'
        ]
      },
      steps: [
        {
          title: 'Clone Repository',
          description: 'Get the FHEVM Wordle source code',
          command: 'git clone https://github.com/light3739/FHEVMWordle.git',
          details: [
            'Clone the official repository',
            'Navigate to the project directory',
            'All dependencies are pre-configured'
          ]
        },
        {
          title: 'Install Dependencies',
          description: 'Install all required packages',
          command: 'npm install',
          details: [
            'Installs Hardhat with FHEVM plugin',
            'Installs React frontend dependencies',
            'Includes ethers.js and Zama SDK'
          ]
        },
        {
          title: 'Environment Setup',
          description: 'Configure your environment variables',
          command: 'cp .env.example .env',
          details: [
            'Copy environment template',
            'Add your INFURA_API_KEY',
            'Add PRIVATE_KEY for deployment',
            'Set REACT_APP_CONTRACT_ADDRESS after deployment'
          ]
        }
      ],
      codeExample: `# Complete setup sequence
git clone https://github.com/light3739/FHEVMWordle.git
cd FHEVMWordle
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials:
# - INFURA_API_KEY
# - PRIVATE_KEY (for deployment)
# - REACT_APP_CONTRACT_ADDRESS (after deployment)

# Start the React app
npm start
# Open http://localhost:3000`
    },
    {
      id: 'how-it-works',
      title: 'How FHEVM Wordle Works',
      description: 'The FHE Magic Explained - Step by Step',
      type: 'concept',
      content: {
        mainText: 'FHEVM Wordle uses Fully Homomorphic Encryption to keep the secret word encrypted while still allowing the smart contract to verify guesses. Here\'s how the magic happens:',
        steps: [
          {
            title: 'Step 1: Encrypt the Secret Word (Client-side)',
            description: 'User selects "HELLO" and it gets encrypted before going to blockchain',
            code: `const word = 'HELLO';
const letters = word.split('').map(ch => ch.charCodeAt(0) - 64); // [8,5,12,12,15]

const input = fheInstance.createEncryptedInput(contractAddress, userAddress);
letters.forEach(letter => input.add8(letter));
const { handles, inputProof } = await input.encrypt();
// handles = [euint8, euint8, euint8, euint8, euint8] (encrypted!)`
          },
          {
            title: 'Step 2: Store on Blockchain (Encrypted)',
            description: 'Secret word is stored encrypted - NO ONE can see it!',
            code: `function setEncryptedSecretWord(...) external {
    // Verify word is in valid dictionary (5,757 words)
    require(MerkleProof.verify(merkleProof, merkleRoot, leaf), "Invalid word");
    
    // Store encrypted letters - NO ONE can see them!
    for (uint8 i = 0; i < 5; i++) {
        encryptedSecretWords[player][i] = FHE.fromExternal(
            encryptedLetters[i].fromBytes(),
            inputProof
        );
        FHE.allowThis(encryptedSecretWords[player][i]);
    }
}`
          },
          {
            title: 'Step 3: Submit a Guess (Plain Text)',
            description: 'User guesses "WORLD" in plain text',
            code: `// User guesses "WORLD"
const guess = [23, 15, 18, 12, 4]; // W=23, O=15, R=18, L=12, D=4
await contract.submitGuess(guess);`
          },
          {
            title: 'Step 4: Compute Results (Homomorphic - The Magic!)',
            description: 'Smart contract compares encrypted secret with plain guess',
            code: `// Check exact match - COMPUTED ON ENCRYPTED DATA!
ebool exact = FHE.eq(guessLetter, secretLetter);

// Check if letter exists anywhere in the word
ebool present = FHE.asEbool(false);
for (uint8 q = 0; q < 5; q++) {
    if (q != position) {
        present = FHE.or(present, FHE.eq(guessLetter, encryptedSecretWords[msg.sender][q]));
    }
}

// Encode result: 1=absent, 2=present, 3=correct
euint8 result = FHE.asEuint8(1);
result = FHE.select(FHE.and(FHE.not(exact), present), FHE.asEuint8(2), result);
result = FHE.select(exact, FHE.asEuint8(3), result);`
          },
          {
            title: 'Step 5: Decrypt Results (Zama KMS)',
            description: 'Results are decrypted asynchronously by Zama KMS',
            code: `function requestDecryptResults() external {
    // Batch decrypt all 5 results in ONE call!
    bytes32[] memory cts = new bytes32[](5);
    for (uint8 i = 0; i < 5; i++) {
        cts[i] = FHE.toBytes32(encryptedResults[msg.sender][lastAttempt][i]);
    }
    
    // Async decryption request to Zama KMS
    uint256 requestId = FHE.requestDecryption(cts, this.resultsCallback.selector);
}`
          },
          {
            title: 'Step 6: Display Results (UI)',
            description: 'Frontend receives decrypted results and shows colors',
            code: `contract.on('GuessEvaluated', (player, attemptNumber, results) => {
  // results = [1,2,1,3,1]
  // Transform to colors:
  // 1 = ⬛ (absent)
  // 2 = 🟨 (present, wrong position)  
  // 3 = 🟩 (correct position)
  
  // Display: W⬛ O🟨 R⬛ L🟩 D⬛
  updateGrid(
    results.map(r => (r === 3 ? 'correct' : r === 2 ? 'present' : 'absent'))
  );
});`
          }
        ]
      }
    },
    {
      id: 'contract',
      title: 'Smart Contract Overview',
      description: 'Main Contract: FHEVMWordleMerkle.sol',
      type: 'code-heavy',
      content: {
        overview: 'The main contract uses encrypted storage and homomorphic operations to maintain game state while keeping the secret word confidential.',
        contractStructure: {
          constants: [
            'uint8 public constant WORD_LENGTH = 5',
            'uint8 public constant MAX_ATTEMPTS = 6', 
            'uint256 public constant GAME_TIMEOUT = 24 hours'
          ],
          encryptedStorage: [
            'mapping(address => euint8[5]) private encryptedSecretWords',
            'mapping(address => euint8[5][6]) private encryptedGuesses',
            'mapping(address => euint8[5][6]) private encryptedResults'
          ],
          gameState: [
            'mapping(address => GameData) public games',
            'mapping(address => PlayerStats) public playerStats'
          ]
        },
        keyFeatures: [
          '🔐 Secret word stored encrypted on-chain',
          '🧮 Homomorphic operations: FHE.eq(), FHE.or(), FHE.select()',
          '📊 Batch decryption: 5 values in 1 request',
          '⚡ Gas optimized: ~25,000 gas saved per game',
          '🛡️ Merkle Tree validation (5,757 valid words)'
        ]
      },
      functions: [
        {
          name: 'startGame(bytes32 sessionHash)',
          description: 'Initialize new game and select random word',
          purpose: 'Sets up game state and selects word from dictionary'
        },
        {
          name: 'setEncryptedSecretWord(...)',
          description: 'Store encrypted secret word with Merkle proof',
          purpose: 'Validates word and stores encrypted letters'
        },
        {
          name: 'submitGuess(uint8[5] calldata guess)',
          description: 'Submit player guess and evaluate with FHE',
          purpose: 'Compares guess against encrypted secret word'
        },
        {
          name: 'requestDecryptResults()',
          description: 'Request batch decryption of results',
          purpose: 'Gets decrypted feedback for UI display'
        },
        {
          name: 'resultsCallback(uint256 requestId, bytes memory clear)',
          description: 'Receive decrypted results from Zama KMS',
          purpose: 'Processes decrypted results and emits events'
        }
      ],
      gasCosts: {
        title: 'Gas Costs Breakdown',
        operations: [
          { name: 'startGame()', gas: '~225,000', description: 'Initialize game state, select random word' },
          { name: 'setEncryptedSecretWord()', gas: '~7,950,000', description: '5× FHE.fromExternal + 5× FHE.allowThis (expensive!)' },
          { name: 'submitGuess()', gas: '~325,000', description: 'Store guess + evaluate with FHE operations' },
          { name: 'requestDecryptResults()', gas: '~75,000', description: 'Request batch decryption from KMS' }
        ],
        total: '~8,575,000 gas per complete game cycle with 1 guess'
      },
      codeExample: `contract FHEVMWordleMerkle is SepoliaConfig {
    // Constants
    uint8 public constant WORD_LENGTH = 5;
    uint8 public constant MAX_ATTEMPTS = 6;
    uint256 public constant GAME_TIMEOUT = 24 hours;

    // Encrypted storage
    mapping(address => euint8[5]) private encryptedSecretWords;
    mapping(address => euint8[5][6]) private encryptedGuesses;
    mapping(address => euint8[5][6]) private encryptedResults;

    // Game state
    mapping(address => GameData) public games;
    mapping(address => PlayerStats) public playerStats;

    // Core functions
    function startGame(bytes32 sessionHash) external;
    function setEncryptedSecretWord(...) external;
    function submitGuess(uint8[5] calldata guess) external;
    function requestDecryptResults() external;
    function resultsCallback(uint256 requestId, bytes memory clear) external;

    // Game management
    function pauseMyGame() external;
    function unpauseMyGame() external;
    function forfeitGame() external;
}`
    },
    {
      id: 'frontend',
      title: 'Frontend Integration',
      description: 'Connecting React frontend to FHEVM smart contracts',
      type: 'integration',
      content: {
        mainText: 'The React frontend uses ethers.js and Zama\'s Relayer SDK to interact with FHEVM contracts. Here\'s how to set up the connection:',
        setup: {
          title: 'Contract Setup',
          description: 'Initialize FHEVM instance and connect to contract'
        },
        features: [
          '🔗 Connect to wallet via MetaMask',
          '🔐 Initialize FHEVM instance with Sepolia config',
          '📡 Send encrypted transactions using Relayer SDK',
          '👂 Listen to events for async results',
          '🎨 Display real-time game feedback'
        ]
      },
      codeExample: `import { ethers } from 'ethers';
import { initSDK, createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk/bundle';

// Initialize FHEVM
await initSDK(); // Load needed WASM
const config = { ...SepoliaConfig, network: window.ethereum };
const fheInstance = await createInstance(config);

// Setup contract connection
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

// Encrypt secret word
const word = 'HELLO';
const letters = word.split('').map(ch => ch.charCodeAt(0) - 64);
const input = fheInstance.createEncryptedInput(CONTRACT_ADDRESS, await signer.getAddress());
letters.forEach(letter => input.add8(letter));
const { handles, inputProof } = await input.encrypt();

// Submit encrypted word
const tx = await contract.setEncryptedSecretWord(
  await signer.getAddress(),
  wordIndex,
  handles,
  inputProof,
  merkleProof,
  leaf
);
await tx.wait();

// Listen for results
contract.on('GuessEvaluated', (player, attemptNumber, results) => {
  // results = [1,2,1,3,1] -> ⬛🟨⬛🟩⬛
  updateGameGrid(results);
});`
    },
    {
      id: 'deployment',
      title: 'Deploy to Sepolia',
      description: 'Deploying FHEVM Wordle to Sepolia testnet',
      type: 'deployment',
      content: {
        mainText: 'Deploy the FHEVM Wordle contract to Sepolia testnet and connect your frontend.',
        steps: [
          {
            title: 'Compile Contracts',
            description: 'Build the smart contracts',
            command: 'npx hardhat compile'
          },
          {
            title: 'Deploy to Sepolia',
            description: 'Deploy contract to Sepolia testnet',
            command: 'npx hardhat run deploy/01-deploy-wordle.js --network sepolia'
          },
          {
            title: 'Update Environment',
            description: 'Add contract address to frontend',
            note: 'Update REACT_APP_CONTRACT_ADDRESS in .env with deployed address'
          },
          {
            title: 'Verify on Etherscan',
            description: 'Verify contract source code',
            command: 'npx hardhat verify --network sepolia <CONTRACT_ADDRESS>'
          }
        ]
      },
      liveDemo: {
        title: 'Live Demo',
        contractAddress: '0xFA23f4beB2238261011Edec693e08871732a0108',
        network: 'Sepolia (Chain ID: 11155111)',
        explorer: 'https://sepolia.etherscan.io/address/0xFA23f4beB2238261011Edec693e08871732a0108',
        merkleRoot: '0xf8ee73c7257f661083f8bc64309b79cdbc6d3d37b24dc694eab774ae3120794b',
        dictionary: '5,756 valid English words'
      },
      howToPlay: [
        '🔗 Connect Wallet (MetaMask on Sepolia)',
        '🎮 Start New Game (contract auto-selects random word)',
        '⏳ Wait for Setup (~30-60 seconds for encryption)',
        '🎯 Make Guesses (type 5-letter words)',
        '🎨 Interpret Results (🟩🟨⬛ colors)',
        '🏆 Win or Learn (6 attempts maximum)'
      ],
      codeExample: `// deploy/01-deploy-wordle.js
const { ethers } = require("hardhat");

async function main() {
  const FHEVMWordleMerkle = await ethers.getContractFactory("FHEVMWordleMerkle");
  const wordle = await FHEVMWordleMerkle.deploy();
  
  await wordle.waitForDeployment();
  
  console.log("FHEVMWordleMerkle deployed to:", await wordle.getAddress());
  console.log("Merkle Root:", await wordle.merkleRoot());
  console.log("Dictionary Size:", await wordle.merkleLeaves());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
    },
    {
      id: 'faq',
      title: 'FAQ & Troubleshooting',
      description: 'Common questions and solutions for FHEVM Wordle',
      type: 'faq',
      content: {
        mainText: 'Here are answers to the most common questions about FHEVM Wordle:',
        faq: [
          {
            question: 'Do I need to understand cryptography?',
            answer: 'No! This project abstracts away the complexity. You just use FHE.eq(), FHE.or(), etc.'
          },
          {
            question: 'Why is gas so expensive?',
            answer: 'FHE operations are computationally intensive. Regular comparison: ~20 gas, FHE comparison: ~50,000 gas. But the alternative is NO on-chain privacy at all!'
          },
          {
            question: 'Can I use this in production?',
            answer: 'FHEVM is currently in testnet. For production use, wait for mainnet launch or check Zama\'s roadmap.'
          },
          {
            question: 'How long does decryption take?',
            answer: 'Usually 30-60 seconds. Zama is working on making this faster.'
          },
          {
            question: 'Can the contract owner cheat?',
            answer: 'No! The secret is encrypted and even the owner can\'t decrypt it without going through proper KMS flow.'
          },
          {
            question: 'What if I refresh the page mid-game?',
            answer: 'Game state is stored on-chain! Just reconnect your wallet and continue.'
          }
        ]
      },
      problems: [
        {
          title: '🔗 Wallet/Network Issues',
          description: 'Make sure MetaMask is connected to Sepolia network',
          solutions: [
            'Switch MetaMask to Sepolia testnet (Chain ID: 11155111)',
            'Get test ETH from Sepolia Faucet',
            'Wrong chainId will cause transactions to fail'
          ]
        },
        {
          title: '⏱️ Long Decryption Delays',
          description: 'Decryption can take 30-60 seconds',
          solutions: [
            'Be patient after each guess',
            'Check browser console for events',
            'Don\'t refresh the page during decryption'
          ]
        },
        {
          title: '💥 Transaction Failures',
          description: 'Common causes of failed transactions',
          solutions: [
            'Ensure you have enough Sepolia ETH for gas',
            'Check that word is in the valid dictionary',
            'Verify Merkle proof is correct'
          ]
        },
        {
          title: '🔄 Frontend Connection Issues',
          description: 'If frontend can\'t connect to contract',
          solutions: [
            'Check REACT_APP_CONTRACT_ADDRESS in .env',
            'Ensure contract is deployed on Sepolia',
            'Verify ABI matches deployed contract'
          ]
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
            <h1 className={styles.title}>FHEVM Wordle - Interactive Developer Tutorial</h1>
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
