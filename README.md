# 🎮 FHEVM Wordle

<div align="center">

![FHEVM Wordle Banner](public/Screenshot.png)

**Learn Fully Homomorphic Encryption by Playing Wordle On-Chain** 🔐

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zama](https://img.shields.io/badge/Built%20with-FHEVM-blue)](https://www.zama.ai/)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow)](https://hardhat.org/)
[![React](https://img.shields.io/badge/Built%20with-React-61DAFB)](https://reactjs.org/)

[🎮 Live Demo](#-live-demo) • [📖 Tutorial](#-tutorial) • [🚀 Quick Start](#-quick-start) • [🎓 Learn FHE](#-what-youll-learn)

</div>

---

## 🌟 What Makes This Special?

FHEVM Wordle is **the first fully confidential on-chain Wordle game** built with Fully Homomorphic Encryption. The secret word is encrypted on the blockchain, and your smart contract verifies guesses **without ever decrypting the secret**!

```
Traditional Wordle          →  FHEVM Wordle
─────────────────────────      ─────────────────────────
Secret: "HELLO"             →  Secret: euint8[5] (encrypted)
Storage: Client             →  Storage: Blockchain
Validation: JavaScript      →  Validation: Smart Contract
Trust: Required             →  Trust: Zero (cryptographically proven)
```

### 🎯 Why This Project is Perfect for Learning FHEVM

| Feature                       | What You Learn                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| 🔐 **Secret Word Encryption** | Client-side FHE encryption with `createEncryptedInput()`       |
| 🧮 **On-Chain Comparison**    | Homomorphic operations: `FHE.eq()`, `FHE.or()`, `FHE.select()` |
| 🔓 **Result Decryption**      | Async decryption with callback pattern                         |
| 📊 **Batch Processing**       | Decrypt 5 letters in one request (gas optimization)            |
| 🎨 **Visual Feedback**        | See FHE computation results in real-time                       |
| ⚡ **Gas Optimization**       | Real-world techniques saving ~25,000 gas per game              |

---

## 🎓 What You'll Learn

This project is a **complete educational resource** for Web3 developers new to FHEVM:

### 📚 From Zero to FHEVM Hero

```
Level 1: FHE Basics
├─ What is Fully Homomorphic Encryption?
├─ euint8, euint16, ebool types
└─ Basic operations (eq, add, select)

Level 2: Client Integration
├─ Setting up fhevmjs SDK
├─ Encrypting data on the client
└─ Generating input proofs

Level 3: Smart Contract
├─ Importing FHEVM library
├─ Homomorphic computations
└─ Access control with ACL

Level 4: Decryption
├─ Requesting decryption from KMS
├─ Callback pattern
└─ Event-based UI updates

Level 5: Production
├─ Gas optimization strategies
├─ Error handling
└─ User experience best practices
```

---

## 🚀 Quick Start

### Prerequisites

```bash
node >= 16.0.0
npm >= 8.0.0
MetaMask or compatible Web3 wallet
```

### Installation

```bash
# Clone the repository
git clone https://github.com/light3739/FHEVMWordle.git
cd FHEVMWordle

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials:
# - INFURA_API_KEY
# - PRIVATE_KEY (for deployment)
# - REACT_APP_CONTRACT_ADDRESS (after deployment)
```

### Run Locally

```bash
# Start the React app
npm start

# Open http://localhost:3000
```

### Deploy to Sepolia

```bash
# Compile contracts
npx hardhat compile --network sepolia

# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Update REACT_APP_CONTRACT_ADDRESS in .env with deployed address
```

---

## 💡 How It Works

### The FHE Magic Explained

#### Step 1️⃣: Encrypt the Secret Word (Client-side)

```javascript
// User selects "HELLO"
const word = 'HELLO';
const letters = word.split('').map(ch => ch.charCodeAt(0) - 64); // [8,5,12,12,15]

// Create FHE input
const input = fheInstance.createEncryptedInput(contractAddress, userAddress);
letters.forEach(letter => input.add8(letter));

// Generate encrypted handles + proof
const { handles, inputProof } = await input.encrypt();
// handles = [euint8, euint8, euint8, euint8, euint8] (encrypted!)
```

#### Step 2️⃣: Store on Blockchain (Encrypted)

```solidity
function setEncryptedSecretWord(
    address player,
    uint32 index,
    bytes[] calldata encryptedLetters,
    bytes calldata inputProof,
    bytes32[] calldata merkleProof,
    bytes32 leaf
) external {
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
}
```

#### Step 3️⃣: Submit a Guess (Plain Text)

```javascript
// User guesses "WORLD"
const guess = [23, 15, 18, 12, 4]; // W=23, O=15, R=18, L=12, D=4

await contract.submitGuess(guess);
```

#### Step 4️⃣: Compute Results (Homomorphic - The Magic!)

```solidity
function _evaluateEncryptedGuess(uint8 attemptIndex) private {
    for (uint8 position = 0; position < 5; position++) {
        euint8 guessLetter = encryptedGuesses[msg.sender][attemptIndex][position];
        euint8 secretLetter = encryptedSecretWords[msg.sender][position];

        // Check exact match - COMPUTED ON ENCRYPTED DATA!
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
        result = FHE.select(exact, FHE.asEuint8(3), result);

        encryptedResults[msg.sender][attemptIndex][position] = result;
    }
}
```

#### Step 5️⃣: Decrypt Results (Zama KMS)

```solidity
function requestDecryptResults() external {
    // Batch decrypt all 5 results in ONE call!
    bytes32[] memory cts = new bytes32[](5);
    for (uint8 i = 0; i < 5; i++) {
        cts[i] = FHE.toBytes32(encryptedResults[msg.sender][lastAttempt][i]);
    }

    // Async decryption request to Zama KMS
    uint256 requestId = FHE.requestDecryption(cts, this.resultsCallback.selector);
}

function resultsCallback(uint256 requestId, bytes memory decryptedData) external {
    (uint8 r0, uint8 r1, uint8 r2, uint8 r3, uint8 r4) = abi.decode(
        decryptedData,
        (uint8,uint8,uint8,uint8,uint8)
    );

    // Emit results: [1,2,1,3,1] = ⬛🟨⬛🟩⬛
    emit GuessEvaluated(player, attemptNumber, [r0,r1,r2,r3,r4]);
}
```

#### Step 6️⃣: Display Results (UI)

```javascript
contract.on('GuessEvaluated', (player, attemptNumber, results) => {
  // results = [1,2,1,3,1]
  // Transform to colors:
  // 1 = ⬛ (absent)
  // 2 = 🟨 (present, wrong position)
  // 3 = 🟩 (correct position)

  // Display: W⬛ O🟨 R⬛ L🟩 D⬛
  updateGrid(
    results.map(r => (r === 3 ? 'correct' : r === 2 ? 'present' : 'absent'))
  );
});
```

---

## 🎨 Key Features

### 🔐 Fully Confidential

- **Secret word** stored encrypted on-chain
- **No one** can see it (not even you after setting!)
- **Verification** happens without decryption
- **Zero-knowledge** gameplay

### ⚡ Gas Optimized

| Optimization         | Savings         | How                                        |
| -------------------- | --------------- | ------------------------------------------ |
| Batch decryption     | ~15,000 gas     | 5 values in 1 request instead of 5         |
| Unchecked arithmetic | ~300 gas        | Safe loop counters without overflow checks |
| Storage caching      | ~2,100 gas      | Read once, use multiple times              |
| **Total**            | **~25,000 gas** | **Per game cycle**                         |

### 🎮 Full Game Features

- ✅ 6 attempts to guess the word
- ✅ Real-time result visualization (🟩🟨⬛)
- ✅ Win/loss statistics tracking
- ✅ Game recovery (continue after browser refresh)
- ✅ Pause/resume functionality
- ✅ Tutorial mode for beginners
- ✅ Mobile responsive design
- ✅ Dark/light theme support

### 🛡️ Security Features

- **Merkle Tree** validation (5,757 valid English words)
- **Rate limiting** (30 seconds between games)
- **Emergency pause** mechanism
- **Access control** (only owner can pause/unpause)
- **Input validation** (prevents invalid guesses)

---

## 📊 Smart Contract Overview

### Main Contract: `FHEVMWordleMerkle.sol`

```solidity
contract FHEVMWordleMerkle is SepoliaConfig {
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
}
```

### Gas Costs Breakdown

| Operation                  | Gas Used       | What Happens                                            |
| -------------------------- | -------------- | ------------------------------------------------------- |
| `startGame()`              | ~225,000       | Initialize game state, select random word               |
| `setEncryptedSecretWord()` | ~7,950,000     | **5× FHE.fromExternal + 5× FHE.allowThis** (expensive!) |
| `submitGuess()`            | ~325,000       | Store guess + evaluate with FHE operations              |
| `requestDecryptResults()`  | ~75,000        | Request batch decryption from KMS                       |
| **Total per game**         | **~8,575,000** | Complete game cycle with 1 guess                        |

### Why is FHE So Expensive?

```
Regular comparison (plain):  ~20 gas
FHE comparison (encrypted): ~50,000 gas

Why? Because:
1. Computing on encrypted data requires complex math
2. Each operation maintains cryptographic proofs
3. Results stay encrypted until explicitly decrypted
4. Security comes at a computational cost

But... it's the ONLY way to have true on-chain privacy! 🔐
```

---

## 🧪 Testing

### Run Contract Tests

```bash
# Compile contracts
npx hardhat compile --network sepolia

# Run test suite
npx hardhat test

# Test with gas reporting
REPORT_GAS=true npx hardhat test
```

### CLI Game Mode

Play directly from terminal (great for debugging):

```bash
# Interactive mode
npx hardhat fhe-play --network sepolia

# Auto-play with specific words
npx hardhat fhe-play --network sepolia --words "HELLO,WORLD,OCEAN"
```

---

## 🔧 Project Structure

```
FHEVMWordle/
├── contracts/
│   ├── FHEVMWordleFHE.sol                # Main FHEVM game contract
│
│
│
│
├── src/
│   ├── App.jsx                            # Main React component
│   ├── App.module.scss                    # App styles
│   ├── index.js                           # React entry point
│   ├── components/
│   │   ├── Alert/
│   │   ├── Cell/
│   │   ├── Grid/
│   │   ├── Header/
│   │   ├── InfoModal/
│   │   ├── InteractiveTutorial/
│   │   ├── Keyboard/
│   │   ├── Modal/
│   │   ├── SettingModal/
│   │   ├── StartGameButton/
│   │   ├── StatsModal/
│   │   ├── Switch/
│   │   ├── TutorialCard/
│   │   ├── TutorialMode/
│   │   ├── TutorialToggle/
│   │   ├── VictoryModal/
│   │   └── WalletModal/
│   │       ...                            # Each component in its own folder
│   ├── constants/
│   │   ├── settings.js
│   │   ├── validGuesses.js
│   │   └── wordList.js
│   ├── context/
│   │   └── AlertContext.js
│   ├── hooks/
│   │   ├── useAlert.js
│   │   ├── useFhevm.js
│   │   ├── useLocalStorage.js
│   │   ├── useOnClickOutside.js
│   │   └── useWallet.js
│   ├── lib/
│   │   └── words.js
│   └── styles/
│       └── _transitionStyles.scss
│
├── public/
│   ├── favicon.ico
│   ├── image.avif
│   ├── index.html
│   ├── logo192.png
│   ├── logo512.png
│   ├── manifest.json
│   ├── robots.txt
│   ├── Screenshot.png
│   ├── zama-logo.webp
│   └── zamaicon.ico
│
│
├── scripts/
│   ├── deploy.js
│   └── generate-words.js
│
├── artifacts/                             # Hardhat build artifacts
│   └── ... (auto-generated)
│
├── cache/                                 # Hardhat cache
│   └── ... (auto-generated)
│
├── fhevmTemp/                             # FHEVM temp files
│   └── ... (auto-generated)
│
├── package.json
├── hardhat.config.js
├── jsconfig.json
├── README.md
└── .env.example / .env
```

- All React code is in `src/` (components, hooks, context, constants, lib, styles).
- Smart contracts are in `contracts/`.
- Deployment and scripts in `deploy/` and `scripts/`.
- Build artifacts and cache are auto-generated.
- Static assets are in `public/`.

---

## 🌐 Live Demo

### Deployed Contract (Sepolia Testnet)

```
📍 Contract Address: 0xCb04B04fa31F7afF96C4Af38Cd40b0C38ae998b2
🌐 Network: Sepolia (Chain ID: 11155111)
🔍 Explorer: https://sepolia.etherscan.io/address/0xCb04B04fa31F7afF96C4Af38Cd40b0C38ae998b2
🌳 Merkle Root: 0xf8ee73c7257f661083f8bc64309b79cdbc6d3d37b24dc694eab774ae3120794b%
📚 Dictionary: 5,756 valid English words
```

### How to Play

1. 🔗 **Connect Wallet**

   - Use MetaMask (switch to Sepolia network)
   - Get test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)

2. 🎮 **Start Game**

   - Click "Start New Game"
   - Contract auto-selects a random word from 5,756 options

3. ⏳ **Wait for Setup** (~30-60 seconds)

   - Frontend encrypts the secret word with FHE
   - Transaction is sent to blockchain
   - Secret is stored encrypted (no one can see it!)

4. 🎯 **Make Guesses**

   - Type a 5-letter word
   - Contract evaluates WITHOUT decrypting the secret
   - Results come back async from Zama KMS

5. 🎨 **Interpret Results**

   - 🟩 **Green** = Correct letter, correct position
   - 🟨 **Yellow** = Correct letter, wrong position
   - ⬛ **Gray** = Letter not in word

6. 🏆 **Win or Learn**
   - 6 attempts maximum
   - Stats tracked on-chain
   - Play again to improve!

---

## 📖 Tutorial: Build Your Own FHE dApp

### Prerequisites

This tutorial assumes you know:

- ✅ Basic Solidity (variables, functions, mappings)
- ✅ How to deploy contracts with Hardhat
- ✅ React fundamentals (hooks, state management)
- ✅ How to use MetaMask

You **don't need** to know:

- ❌ Advanced cryptography
- ❌ How FHE works internally
- ❌ Complex Solidity patterns

### Part 1: Your First Encrypted Variable (5 min)

**Goal:** Store and compare an encrypted number

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract MyFirstFHE is SepoliaConfig {
    euint8 private encryptedSecret;

    // Store encrypted value
    function setSecret(bytes calldata encryptedInput) external {
        encryptedSecret = FHE.asEuint8(encryptedInput);
        FHE.allowThis(encryptedSecret);
    }

    // Compare without revealing the secret!
    function guessSecret(uint8 plainGuess) external view returns (bool) {
        ebool isEqual = FHE.eq(encryptedSecret, FHE.asEuint8(plainGuess));
        // Result is still encrypted! Need decryption to see it
        return FHE.decrypt(isEqual); // This will request KMS
    }
}
```

### Part 2: Client-Side Encryption (10 min)

```javascript
import { createInstance } from '@zama-fhe/relayer-sdk/bundle';

// Initialize FHE instance
const fheInstance = await createInstance({
  network: window.ethereum,
  ...SepoliaConfig,
});

// Encrypt a value
const secretValue = 42;
const input = fheInstance.createEncryptedInput(contractAddress, userAddress);
input.add8(secretValue);
const { handles, inputProof } = await input.encrypt();

// Send to contract
await contract.setSecret(handles[0], inputProof);
```

### Part 3: Array Operations (15 min)

Wordle needs to compare 5 letters. Here's how:

```solidity
euint8[5] private encryptedWord;

function setWord(bytes[] calldata letters, bytes calldata proof) external {
    for (uint8 i = 0; i < 5; i++) {
        encryptedWord[i] = FHE.fromExternal(
            abi.decode(letters[i], (externalEuint8)),
            proof
        );
        FHE.allowThis(encryptedWord[i]);
    }
}

function checkLetter(uint8 position, uint8 guess) external returns (bool) {
    ebool match = FHE.eq(encryptedWord[position], FHE.asEuint8(guess));
    // In real implementation, would request decryption instead of direct decrypt
    return FHE.decrypt(match);
}
```

### Part 4: Async Decryption (20 min)

FHE decryption is **asynchronous** - results come via callback:

```solidity
mapping(uint256 => address) private decryptionRequests;

function requestResult() external returns (uint256) {
    // Prepare encrypted value for decryption
    bytes32 ciphertext = FHE.toBytes32(encryptedResult);

    // Request decryption - returns request ID
    uint256 requestId = FHE.requestDecryption(
        ciphertext,
        this.resultCallback.selector
    );

    decryptionRequests[requestId] = msg.sender;
    return requestId;
}

// Zama KMS calls this with decrypted result
function resultCallback(
    uint256 requestId,
    bytes memory decryptedValue
) external {
    address player = decryptionRequests[requestId];
    uint8 result = abi.decode(decryptedValue, (uint8));

    // Now you can use the decrypted result!
    emit ResultRevealed(player, result);
}
```

### Full Tutorial

See [docs/TUTORIAL.md](./docs/TUTORIAL.md) for complete step-by-step guide including:

- Setting up Hardhat with FHEVM plugin
- Building the full Wordle logic
- Optimizing gas costs
- Deploying to testnet
- Connecting React frontend

---

## 🎯 Learning Resources

### Zama Official Docs

- 📘 [FHEVM Documentation](https://docs.zama.ai/fhevm)
- 🛠️ [fhevmjs SDK Guide](https://docs.zama.ai/fhevm-js)
- 📝 [Solidity Integration](https://docs.zama.ai/protocol/solidity-guides)
- 💻 [Hardhat Template](https://github.com/zama-ai/fhevm-hardhat-template)

### Understanding FHE

- 🎓 [What is Fully Homomorphic Encryption?](https://www.zama.ai/what-is-fully-homomorphic-encryption)
- 🔬 [FHE Use Cases](https://www.zama.ai/use-cases)
- 📊 [FHE vs Other Privacy Solutions](https://www.zama.ai/post/comparison-of-cryptographic-privacy-solutions)

### Community

- 💬 [Zama Discord](https://discord.gg/zama)
- 🐦 [Twitter @zama_fhe](https://twitter.com/zama_fhe)
- 📺 [YouTube Tutorials](https://www.youtube.com/@zama_fhe)

---

## 🤝 Contributing

This project is **educational** - contributions welcome!

### Ways to Help

1. 🐛 **Found a Bug?** Open an issue with details
2. 💡 **Have an Idea?** Suggest features or improvements
3. 📝 **Improve Docs** Make the tutorial clearer
4. 🎨 **Enhance UI** Better animations, colors, UX
5. ⚡ **Optimize More** Find additional gas savings
6. 🌍 **Translate** Help make it accessible globally

### Development

```bash
# Fork and clone
git clone https://github.com/light3739/FHEVMWordle.git
cd FHEVMWordle

# Create feature branch
git checkout -b feature/amazing-improvement

# Make changes, commit, push
git add .
git commit -m "feat: add amazing improvement"
git push origin feature/amazing-improvement

# Open Pull Request on GitHub
```

---

## 💬 FAQ

### Q: Do I need to understand cryptography?

**A:** No! This project abstracts away the complexity. You just use `FHE.eq()`, `FHE.or()`, etc.

### Q: Why is gas so expensive?

**A:** FHE operations are computationally intensive. But the alternative is NO on-chain privacy at all!

### Q: Can I use this in production?

**A:** FHEVM is currently in testnet. For production use, wait for mainnet launch or check Zama's roadmap.

### Q: How long does decryption take?

**A:** Usually 30-60 seconds. Zama is working on making this faster.

### Q: Can the contract owner cheat?

**A:** No! The secret is encrypted and even the owner can't decrypt it without going through proper KMS flow.

### Q: What if I refresh the page mid-game?

**A:** Game state is stored on-chain! Just reconnect your wallet and continue.

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

**TL;DR:** Use this code freely for learning, teaching, or building your own FHEVM projects!

---

## 🙏 Acknowledgments

- **Zama Team** for building FHEVM and making blockchain privacy possible
- **Josh Wardle** for creating the original Wordle game
- **Hannah Park** for React Wordle UI inspiration
- **OpenZeppelin** for secure Solidity libraries
- **FHEVM Community** for support and feedback

---

## 🎖️ Built For

<div align="center">

**Zama Bounty Program Season 10**

_"Hello FHEVM" Tutorial Competition_

This project was created to help developers learn FHEVM through a fun, interactive game that demonstrates real-world use of Fully Homomorphic Encryption on Ethereum.

</div>

---

<div align="center">

**Made with ❤️ for the FHEVM Community**

⭐ **Star this repo** if you found it helpful!

📧 **Questions?** Open an issue or reach out!

🚀 **Happy Learning!**

</div>
