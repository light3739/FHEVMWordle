require('@nomicfoundation/hardhat-toolbox');
require('@fhevm/hardhat-plugin');
require('dotenv').config();
require('./tasks/fhe-test'); // добавили задачу
require('./tasks/fhe-play')

module.exports = {
  defaultNetwork: 'sepolia',
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: 'http://127.0.0.1:8545', chainId: 31337 },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
  fhevm: { sepolia: { enabled: true } },
  etherscan: { apiKey: { sepolia: process.env.ETHERSCAN_API_KEY } },
};
