import { useState } from 'react';
import TutorialCard from 'components/TutorialCard';
import styles from './InteractiveTutorial.module.scss';

const InteractiveTutorial = () => {
  const [expandedCards, setExpandedCards] = useState(new Set());

  const toggleCard = (cardId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const tutorialCards = [
    {
      id: 'setup',
      title: 'Project Setup & Installation',
      description: 'Get started with FHEVM Wordle development environment',
      icon: 'rocket',
      steps: [
        {
          title: 'Clone the Repository',
          description: 'Start by cloning the FHEVM Wordle repository to your local machine.',
          command: 'git clone https://github.com/your-username/FHEVMWordle.git',
          details: [
            'Navigate to your desired development directory',
            'Ensure you have Git installed on your system',
            'Use HTTPS or SSH based on your GitHub configuration'
          ]
        },
        {
          title: 'Install Dependencies',
          description: 'Install all required Node.js packages and dependencies.',
          command: 'npm install',
          details: [
            'This will install React, Ethers.js, Web3Modal, and other dependencies',
            'Make sure you have Node.js 18+ installed',
            'The installation may take a few minutes'
          ]
        },
        {
          title: 'Verify Installation',
          description: 'Ensure everything is set up correctly by running the development server.',
          command: 'npm start',
          details: [
            'The app should open in your browser at http://localhost:3000',
            'You should see the FHEVM Wordle interface',
            'Check the browser console for any errors'
          ]
        }
      ],
      codeExample: `# Complete setup sequence
git clone https://github.com/your-username/FHEVMWordle.git
cd FHEVMWordle
npm install
npm start

# Verify installation
npm run build
npm test`
    },
    {
      id: 'fhevm',
      title: 'FHEVM Integration',
      description: 'Learn how to integrate Zama AI FHEVM technology',
      icon: 'shield',
      steps: [
        {
          title: 'Install FHEVM Dependencies',
          description: 'Add FHEVM and TFHE libraries to your project.',
          command: 'npm install fhevm @zama-ai/fhevm',
          details: [
            'FHEVM provides the core homomorphic encryption functionality',
            'TFHE library handles encrypted data types',
            'These are essential for privacy-preserving computations'
          ]
        },
        {
          title: 'Configure FHEVM Environment',
          description: 'Set up the FHEVM development environment.',
          command: 'npx fhevm init',
          details: [
            'This initializes FHEVM configuration files',
            'Creates necessary directories and setup files',
            'Configures the development environment for FHE operations'
          ]
        },
        {
          title: 'Import FHEVM in Smart Contracts',
          description: 'Add FHEVM imports to your Solidity contracts.',
          command: 'import "fhevm/lib/TFHE.sol";',
          details: [
            'Import TFHE library for encrypted data types',
            'Use euint8, euint16, etc. for encrypted integers',
            'Enable homomorphic operations on encrypted data'
          ]
        }
      ],
      codeExample: `// contracts/FHEVMWordle.sol
import "fhevm/lib/TFHE.sol";

contract FHEVMWordle {
    using TFHE for euint8;
    
    // Encrypted secret word
    mapping(address => euint8[5]) private encryptedSecretWords;
    
    function setSecretWord(euint8[5] memory encryptedWord) public {
        encryptedSecretWords[msg.sender] = encryptedWord;
    }
    
    function processGuess(euint8[5] memory guess) public view returns (euint8[5]) {
        // Homomorphic comparison
        return TFHE.cmux(
            TFHE.eq(guess[0], encryptedSecretWords[msg.sender][0]),
            guess,
            encryptedSecretWords[msg.sender]
        );
    }
}`
    },
    {
      id: 'contracts',
      title: 'Smart Contract Development',
      description: 'Build and deploy FHEVM-enabled smart contracts',
      icon: 'code',
      steps: [
        {
          title: 'Create FHEVM Contract',
          description: 'Build a new Solidity contract with FHEVM integration.',
          command: 'touch contracts/FHEVMWordle.sol',
          details: [
            'Create a new Solidity file in the contracts directory',
            'Import necessary FHEVM libraries',
            'Define the contract structure with encrypted data types'
          ]
        },
        {
          title: 'Implement Game Logic',
          description: 'Add encrypted game logic to your contract.',
          command: '// Add game functions with FHE operations',
          details: [
            'Create functions for starting games with encrypted words',
            'Implement guess processing using homomorphic operations',
            'Add result calculation without decryption'
          ]
        },
        {
          title: 'Deploy to Testnet',
          description: 'Deploy your contract to Ethereum Sepolia testnet.',
          command: 'npx hardhat run scripts/deploy.js --network sepolia',
          details: [
            'Ensure you have Sepolia ETH for gas fees',
            'Configure Hardhat for Sepolia network',
            'Verify contract deployment on Etherscan'
          ]
        }
      ],
      codeExample: `// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
  const FHEVMWordle = await ethers.getContractFactory("FHEVMWordle");
  const fhevmWordle = await FHEVMWordle.deploy();
  
  await fhevmWordle.waitForDeployment();
  
  console.log("FHEVMWordle deployed to:", await fhevmWordle.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
    },
    {
      id: 'frontend',
      title: 'Frontend Integration',
      description: 'Connect React frontend with FHEVM smart contracts',
      icon: 'gear',
      steps: [
        {
          title: 'Setup Web3 Connection',
          description: 'Configure Web3Modal for wallet connection.',
          command: 'npm install web3modal ethers',
          details: [
            'Web3Modal provides easy wallet connection UI',
            'Ethers.js handles blockchain interactions',
            'Configure for multiple wallet support'
          ]
        },
        {
          title: 'Create FHEVM Hook',
          description: 'Build a custom hook for FHEVM operations.',
          command: '// Create useFHEVM.js hook',
          details: [
            'Handle encrypted data operations',
            'Manage FHEVM contract interactions',
            'Provide easy-to-use interface for components'
          ]
        },
        {
          title: 'Integrate with Game Components',
          description: 'Connect FHEVM functionality to React components.',
          command: '// Update game components',
          details: [
            'Modify game logic to use encrypted operations',
            'Update UI to handle encrypted data',
            'Add loading states for FHE operations'
          ]
        }
      ],
      codeExample: `// hooks/useFHEVM.js
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

export const useFHEVM = (contract, account) => {
  const [isLoading, setIsLoading] = useState(false);
  
  const submitEncryptedGuess = async (encryptedGuess) => {
    setIsLoading(true);
    try {
      const tx = await contract.submitGuess(encryptedGuess);
      await tx.wait();
      return tx;
    } catch (error) {
      console.error('FHEVM operation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return { submitEncryptedGuess, isLoading };
};`
    },
    {
      id: 'testing',
      title: 'Testing & Debugging',
      description: 'Test FHEVM functionality and debug issues',
      icon: 'terminal',
      steps: [
        {
          title: 'Write FHEVM Tests',
          description: 'Create comprehensive tests for FHEVM operations.',
          command: 'npx hardhat test test/FHEVMWordle.test.js',
          details: [
            'Test encrypted data operations',
            'Verify homomorphic computations',
            'Check contract deployment and interaction'
          ]
        },
        {
          title: 'Debug FHEVM Issues',
          description: 'Troubleshoot common FHEVM development problems.',
          command: '// Add debugging logs',
          details: [
            'Use console.log for encrypted data inspection',
            'Check FHEVM configuration and setup',
            'Verify network connectivity and gas limits'
          ]
        },
        {
          title: 'Performance Optimization',
          description: 'Optimize FHEVM operations for better performance.',
          command: '// Optimize gas usage and computation',
          details: [
            'Minimize FHE operations where possible',
            'Use efficient data structures',
            'Implement proper error handling'
          ]
        }
      ],
      codeExample: `// test/FHEVMWordle.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FHEVMWordle', function () {
  it('Should process encrypted guess correctly', async function () {
    const FHEVMWordle = await ethers.getContractFactory('FHEVMWordle');
    const fhevmWordle = await FHEVMWordle.deploy();
    
    // Test encrypted operations
    const encryptedWord = [1, 2, 3, 4, 5]; // Example encrypted data
    await fhevmWordle.setSecretWord(encryptedWord);
    
    const result = await fhevmWordle.processGuess(encryptedWord);
    expect(result).to.not.be.undefined;
  });
});`
    },
    {
      id: 'deployment',
      title: 'Production Deployment',
      description: 'Deploy your FHEVM application to production',
      icon: 'rocket',
      steps: [
        {
          title: 'Prepare for Production',
          description: 'Optimize your application for production deployment.',
          command: 'npm run build',
          details: [
            'Create optimized production build',
            'Minimize bundle size and optimize assets',
            'Test production build locally'
          ]
        },
        {
          title: 'Deploy Smart Contracts',
          description: 'Deploy FHEVM contracts to mainnet.',
          command: 'npx hardhat run scripts/deploy.js --network mainnet',
          details: [
            'Ensure you have sufficient ETH for gas fees',
            'Verify contracts on Etherscan',
            'Update frontend with new contract addresses'
          ]
        },
        {
          title: 'Deploy Frontend',
          description: 'Deploy React frontend to hosting platform.',
          command: 'npm run build && deploy-to-platform',
          details: [
            'Use platforms like Vercel, Netlify, or AWS',
            'Configure environment variables',
            'Set up custom domain if needed'
          ]
        }
      ],
      codeExample: `# Production deployment script
#!/bin/bash

# Build the application
npm run build

# Deploy contracts to mainnet
npx hardhat run scripts/deploy.js --network mainnet

# Deploy frontend to Vercel
vercel --prod

echo "Deployment complete!"`
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting & FAQ',
      description: 'Common issues and solutions for FHEVM development',
      icon: 'gear',
      steps: [
        {
          title: 'FHEVM Connection Issues',
          description: 'Resolve common FHEVM connection problems.',
          command: '// Check FHEVM configuration',
          details: [
            'Verify FHEVM is properly initialized',
            'Check network connectivity',
            'Ensure correct RPC endpoints are configured'
          ]
        },
        {
          title: 'Gas Limit Issues',
          description: 'Handle high gas costs for FHE operations.',
          command: '// Optimize gas usage',
          details: [
            'FHE operations are computationally expensive',
            'Consider batching operations',
            'Use appropriate gas limits for transactions'
          ]
        },
        {
          title: 'Encryption/Decryption Errors',
          description: 'Fix common encryption-related issues.',
          command: '// Debug encryption operations',
          details: [
            'Verify data format before encryption',
            'Check key management and storage',
            'Ensure proper error handling'
          ]
        }
      ],
      codeExample: `// Common troubleshooting patterns
try {
  const result = await contract.processEncryptedGuess(encryptedData);
  console.log('Operation successful:', result);
} catch (error) {
  if (error.message.includes('gas')) {
    console.log('Gas limit exceeded, try increasing gas');
  } else if (error.message.includes('encryption')) {
    console.log('Encryption error, check data format');
  } else {
    console.log('Unknown error:', error);
  }
}`
    }
  ];

  return (
    <div className={styles.tutorialContainer}>
      <div className={styles.tutorialContent}>
        <h1 className={styles.title}>FHEVM Wordle - Interactive Developer Tutorial</h1>
        <p className={styles.subtitle}>
          Learn how to build privacy-preserving applications with Zama AI's FHEVM technology. 
          Click on any card below to see detailed step-by-step instructions.
        </p>
        
        
        <div className={styles.cardsGrid}>
          {tutorialCards.map((card) => (
            <TutorialCard
              key={card.id}
              {...card}
              isExpanded={expandedCards.has(card.id)}
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
            <li>Build your own FHEVM applications</li>
            <li>Contribute to the FHEVM Wordle project</li>
            <li>Join the Zama AI developer community</li>
            <li>Deploy production-ready privacy-preserving dApps</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default InteractiveTutorial;
