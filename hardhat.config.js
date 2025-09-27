require('@nomicfoundation/hardhat-toolbox');
require('@fhevm/hardhat-plugin'); // ВАЖНО!
require('dotenv').config();

module.exports = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  // КРИТИЧЕСКИ ВАЖНО ДЛЯ FHE НА SEPOLIA! 🔥
  fhevm: {
    sepolia: {
      enabled: true, // ВКЛЮЧАЕМ FHE ДЛЯ SEPOLIA!
    },
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
    },
  },
};
