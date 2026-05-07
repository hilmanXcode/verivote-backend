import { ethers, NonceManager } from "ethers";
import * as fs from "fs";
import * as path from "path";

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;
let veriVoteMainContract: ethers.Contract;
let voterRegistryContract: ethers.Contract;
export let activeSignerInstance: ethers.Signer | ethers.Provider;

// Contract ABIs and addresses will be loaded from deployment file
let contractsConfig: any = null;

function loadContractsConfig() {
  // Try loading from config directory first (copied by deploy script)
  const configPath = path.join(__dirname, "contracts.json");
  // Fallback to blockchain deployments directory
  const deploymentPath = path.join(__dirname, "..", "..", "..", "blockchain", "deployments", "localhost.json");

  let loadPath = "";
  if (fs.existsSync(configPath)) {
    loadPath = configPath;
  } else if (fs.existsSync(deploymentPath)) {
    loadPath = deploymentPath;
  } else {
    console.warn("⚠️  No contracts.json found. Deploy contracts first!");
    console.warn("   Run: cd ../blockchain && npm run deploy:local");
    return null;
  }

  const data = fs.readFileSync(loadPath, "utf-8");
  return JSON.parse(data);
}

export async function initBlockchain() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || "";

  provider = new ethers.JsonRpcProvider(rpcUrl);

  if (privateKey) {
    signer = new ethers.Wallet(privateKey, provider);
    console.log("  🔑 Signer address:", signer.address);
  }

  // Load contract ABIs and addresses
  contractsConfig = loadContractsConfig();

  if (contractsConfig) {
    const { VoterRegistry, VeriVoteMain } = contractsConfig.contracts;

    let activeSigner: ethers.Signer | ethers.Provider = provider;
    if (signer) {
      activeSigner = new NonceManager(signer);
      activeSignerInstance = activeSigner;
    }

    voterRegistryContract = new ethers.Contract(
      VoterRegistry.address,
      VoterRegistry.abi,
      activeSigner
    );

    veriVoteMainContract = new ethers.Contract(
      VeriVoteMain.address,
      VeriVoteMain.abi,
      activeSigner
    );

    console.log("  📋 VoterRegistry:", VoterRegistry.address);
    console.log("  🗳️  VeriVoteMain:", VeriVoteMain.address);
  }
}

export function resetBlockchainNonce() {
  if (activeSignerInstance && activeSignerInstance instanceof NonceManager) {
    console.log("♻️  Resetting NonceManager state due to nonce mismatch...");
    activeSignerInstance.reset();
  }
}

export function getProvider() {
  return provider;
}

export function getSigner() {
  return signer;
}

export function getVeriVoteContract() {
  if (!veriVoteMainContract) {
    throw new Error("VeriVoteMain contract not initialized. Deploy contracts first.");
  }
  return veriVoteMainContract;
}

export function getVoterRegistryContract() {
  if (!voterRegistryContract) {
    throw new Error("VoterRegistry contract not initialized. Deploy contracts first.");
  }
  return voterRegistryContract;
}

export function getContractsConfig() {
  return contractsConfig;
}
