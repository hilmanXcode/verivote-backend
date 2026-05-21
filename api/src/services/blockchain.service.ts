import { getVeriVoteContract, getVoterRegistryContract, getSigner, getProvider, resetBlockchainNonce } from "../config/blockchain";
import { ethers } from "ethers";

/**
 * BlockchainService - Bridge between API and Smart Contracts.
 * Handles all blockchain interactions for the VeriVote system.
 */
export class BlockchainService {
  // ============ Voter Registry Operations ============

  /**
   * Helper to execute a transaction and retry once if nonce is desynced
   */
  private static async executeTxWithNonceRetry(txFunc: () => Promise<ethers.ContractTransactionResponse>): Promise<ethers.ContractTransactionReceipt | null> {
    try {
      const tx = await txFunc();
      return await tx.wait();
    } catch (error: any) {
      const errorMsg = error.message?.toLowerCase() || "";
      if (errorMsg.includes("nonce") || errorMsg.includes("replacement fee too low")) {
        console.warn("⚠️ Nonce issue detected. Resetting NonceManager and retrying...");
        resetBlockchainNonce();
        // Retry once
        const tx = await txFunc();
        return await tx.wait();
      }
      throw error;
    }
  }

  /**
   * Register a voter on the blockchain.
   */
  static async registerVoter(
    walletAddress: string,
    nim: string,
    name: string,
    role: number // 0=User, 1=Operator, 2=Admin
  ): Promise<{ txHash: string; success: boolean }> {
    try {
      const registry = getVoterRegistryContract();
      const receipt = await this.executeTxWithNonceRetry(() => registry.registerVoter(walletAddress, nim, name, role));
      return { txHash: receipt!.hash, success: true };
    } catch (error: any) {
      console.error("Blockchain registerVoter error full:", error);
      throw error;
    }
  }

  /**
   * Check if an address is registered.
   */
  static async isVoterRegistered(address: string): Promise<boolean> {
    try {
      const registry = getVoterRegistryContract();
      return await registry.isRegistered(address);
    } catch (error: any) {
      console.error("Blockchain isVoterRegistered error:", error.message);
      return false;
    }
  }

  /**
   * Get voter info by address.
   */
  static async getVoterByAddress(address: string) {
    try {
      const registry = getVoterRegistryContract();
      const voter = await registry.getVoterByAddress(address);
      return {
        nim: voter.nim,
        name: voter.name,
        role: Number(voter.role),
        isRegistered: voter.isRegistered,
        registeredAt: Number(voter.registeredAt),
      };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  // ============ Election Operations ============

  /**
   * Create a new election on the blockchain.
   */
  static async createElection(
    title: string,
    description: string,
    totalVoters: number
  ): Promise<{ txHash: string; electionId: number }> {
    try {
      const contract = getVeriVoteContract();
      const receipt = await this.executeTxWithNonceRetry(() => contract.createElection(title, description, totalVoters));

      // Extract election ID from event logs
      const event = receipt!.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === "ElectionCreated";
        } catch {
          return false;
        }
      });

      let electionId = 0;
      if (event) {
        const parsed = contract.interface.parseLog(event);
        electionId = Number(parsed?.args.electionId);
      }

      return { txHash: receipt!.hash, electionId };
    } catch (error: any) {
      console.error("Blockchain createElection error:", error.message);
      throw new Error(this.parseBlockchainError(error));
    }
  }

  static async addCandidatesBatch(
    electionId: number,
    candidates: { name: string; description: string; imageHash: string }[]
  ): Promise<{ txHash: string }> {
    try {
      const contract = getVeriVoteContract();

      // Pecah objek menjadi array individual untuk Solidity
      const names = candidates.map(c => c.name);
      const descriptions = candidates.map(c => c.description || "");
      const hashes = candidates.map(c => c.imageHash || "");

      const receipt = await this.executeTxWithNonceRetry(() => contract.addCandidatesBatch(electionId, names, descriptions, hashes));
      return { txHash: receipt!.hash };
    } catch (error: any) {
      console.error("Blockchain addCandidatesBatch error:", error.message);
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Add a candidate to an election.
   */
  static async addCandidate(
    electionId: number,
    name: string,
    description: string,
    imageHash: string = ""
  ): Promise<{ txHash: string; candidateId: number }> {
    try {
      const contract = getVeriVoteContract();
      const receipt = await this.executeTxWithNonceRetry(() => contract.addCandidate(electionId, name, description, imageHash));

      const event = receipt!.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === "CandidateAdded";
        } catch {
          return false;
        }
      });

      let candidateId = 0;
      if (event) {
        const parsed = contract.interface.parseLog(event);
        candidateId = Number(parsed?.args.candidateId);
      }

      return { txHash: receipt!.hash, candidateId };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Start an election.
   */
  static async startElection(
    electionId: number,
    durationInSeconds: number
  ): Promise<{ txHash: string }> {
    try {
      const contract = getVeriVoteContract();
      const receipt = await this.executeTxWithNonceRetry(() => contract.startElection(electionId, durationInSeconds));
      return { txHash: receipt!.hash };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * End an election.
   */
  static async endElection(electionId: number): Promise<{ txHash: string }> {
    try {
      const contract = getVeriVoteContract();
      const receipt = await this.executeTxWithNonceRetry(() => contract.endElection(electionId));
      return { txHash: receipt!.hash };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Get election details from blockchain.
   */
  static async getElection(electionId: number) {
    try {
      const contract = getVeriVoteContract();
      const election = await contract.getElection(electionId);
      return {
        id: Number(election.id),
        title: election.title,
        description: election.description,
        status: ["draft", "ongoing", "completed"][Number(election.status)],
        createdBy: election.createdBy,
        createdAt: Number(election.createdAt),
        startDate: Number(election.startDate),
        endDate: Number(election.endDate),
        totalVoters: Number(election.totalVoters),
        totalVotes: Number(election.totalVotes),
        candidateCount: Number(election.candidateCount),
      };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Get all elections from blockchain.
   */
  static async getAllElections() {
    try {
      const contract = getVeriVoteContract();
      const count = Number(await contract.getElectionCount());
      const elections = [];

      for (let i = 1; i <= count; i++) {
        const election = await this.getElection(i);
        elections.push(election);
      }

      return elections;
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Get all candidates for an election.
   */
  static async getCandidates(electionId: number) {
    try {
      const contract = getVeriVoteContract();
      const candidates = await contract.getAllCandidates(electionId);
      return candidates.map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        description: c.description,
        imageHash: c.imageHash,
        voteCount: Number(c.voteCount),
      }));
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  // ============ Voting Operations ============

  /**
   * Cast a vote on behalf of a voter.
   * In production, the voter would sign the transaction directly.
   * For this API-based approach, we use the server's signer.
   */
  static async castVote(
    electionId: number,
    candidateId: number,
    voterAddress: string
  ): Promise<{ txHash: string; voteHash: string }> {
    try {
      const contract = getVeriVoteContract();
      const registry = getVoterRegistryContract();

      console.log(`[castVoteByAdmin] Election: ${electionId}, Candidate: ${candidateId}, Voter: ${voterAddress}`);
      console.log(`[castVoteByAdmin] VeriVoteMain Address: ${await contract.getAddress()}`);
      console.log(`[castVoteByAdmin] Registry Address: ${await registry.getAddress()}`);
      
      const isReg = await registry.isRegistered(voterAddress);
      console.log(`[castVoteByAdmin] isReg before tx: ${isReg}`);

      // Use castVoteByAdmin because the server is signing the transaction 
      // on behalf of the user using the server's wallet.
      const receipt = await this.executeTxWithNonceRetry(() => contract.castVoteByAdmin(electionId, candidateId, voterAddress));

      // Extract vote hash from event
      let voteHash = "";
      const event = receipt!.logs.find((log: any) => {
        try {
          return contract.interface.parseLog(log)?.name === "VoteCast";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = contract.interface.parseLog(event);
        voteHash = parsed?.args.voteHash;
      }

      return { txHash: receipt!.hash, voteHash };
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Check if a voter has already voted in an election.
   */
  static async hasVoterVoted(electionId: number, voterAddress: string): Promise<boolean> {
    try {
      const contract = getVeriVoteContract();
      return await contract.hasVoterVoted(electionId, voterAddress);
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get the vote record for a specific voter in an election.
   */
  static async getVoteRecord(electionId: number, voterAddress: string) {
    try {
      const contract = getVeriVoteContract();
      const record = await contract.voteRecords(electionId, voterAddress);
      // Ensure the record is valid (has a non-zero timestamp)
      if (Number(record.timestamp) === 0) return null;
      return {
        candidateId: Number(record.candidateId),
        timestamp: Number(record.timestamp),
        voteHash: record.voteHash,
      };
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Get election results (only available after completion).
   */
  static async getElectionResults(electionId: number) {
    try {
      const contract = getVeriVoteContract();
      const results = await contract.getElectionResults(electionId);
      return results.map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        description: c.description,
        voteCount: Number(c.voteCount),
      }));
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Get vote verification hash.
   */
  static async getVoteVerification(electionId: number, voterAddress: string): Promise<string> {
    try {
      const contract = getVeriVoteContract();
      return await contract.getVoteVerification(electionId, voterAddress);
    } catch (error: any) {
      throw new Error(this.parseBlockchainError(error));
    }
  }

  /**
   * Get voting status for multiple voters in an election.
   * Uses Promise.all for parallel blockchain queries.
   */
  static async getVotersStatus(
    electionId: number,
    walletAddresses: string[]
  ): Promise<{ walletAddress: string; hasVoted: boolean; votedAt: number | null }[]> {
    try {
      const results = await Promise.all(
        walletAddresses.map(async (address) => {
          const hasVoted = await this.hasVoterVoted(electionId, address);
          let votedAt: number | null = null;
          if (hasVoted) {
            const record = await this.getVoteRecord(electionId, address);
            votedAt = record?.timestamp || null;
          }
          return { walletAddress: address, hasVoted, votedAt };
        })
      );
      return results;
    } catch (error: any) {
      console.error("getVotersStatus error:", error.message);
      return walletAddresses.map(address => ({ walletAddress: address, hasVoted: false, votedAt: null }));
    }
  }

  /**
   * Check if an election is currently active.
   */
  static async isElectionActive(electionId: number): Promise<boolean> {
    try {
      const contract = getVeriVoteContract();
      return await contract.isElectionActive(electionId);
    } catch (error: any) {
      return false;
    }
  }

  /**
   * Get participation rate (basis points, divide by 100 for percentage).
   */
  static async getParticipationRate(electionId: number): Promise<number> {
    try {
      const contract = getVeriVoteContract();
      return Number(await contract.getParticipationRate(electionId));
    } catch (error: any) {
      return 0;
    }
  }

  // ============ Utility ============

  /**
   * Generate a new random wallet address for a user.
   */
  static generateWallet(): { address: string; privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  /**
   * Parse blockchain error messages for user-friendly display.
   */
  private static parseBlockchainError(error: any): string {
    const message = error.message || "";

    // Extract revert reason from error
    const revertMatch = message.match(/reason="([^"]+)"/);
    if (revertMatch) return revertMatch[1];

    const customMatch = message.match(/reverted with reason string '([^']+)'/);
    if (customMatch) return customMatch[1];

    if (message.includes("already voted")) return "Anda sudah memberikan suara pada pemilihan ini.";
    if (message.includes("not registered")) return "Anda belum terdaftar sebagai pemilih.";
    if (message.includes("not ongoing")) return "Pemilihan belum dimulai atau sudah selesai.";
    if (message.includes("election has ended")) return "Waktu pemilihan sudah berakhir.";

    return "Terjadi kesalahan pada blockchain. Silakan coba lagi.";
  }
}
