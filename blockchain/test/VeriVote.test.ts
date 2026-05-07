import { expect } from "chai";
import { ethers } from "hardhat";
import { VoterRegistry, VeriVoteMain } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("VeriVote E-Voting System", function () {
  let voterRegistry: VoterRegistry;
  let veriVoteMain: VeriVoteMain;
  let owner: HardhatEthersSigner;
  let admin: HardhatEthersSigner;
  let operator: HardhatEthersSigner;
  let voter1: HardhatEthersSigner;
  let voter2: HardhatEthersSigner;
  let voter3: HardhatEthersSigner;
  let unregistered: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, admin, operator, voter1, voter2, voter3, unregistered] = await ethers.getSigners();

    // Deploy VoterRegistry
    const VoterRegistryFactory = await ethers.getContractFactory("VoterRegistry");
    voterRegistry = await VoterRegistryFactory.deploy();
    await voterRegistry.waitForDeployment();

    // Deploy VeriVoteMain
    const VeriVoteMainFactory = await ethers.getContractFactory("VeriVoteMain");
    veriVoteMain = await VeriVoteMainFactory.deploy(await voterRegistry.getAddress());
    await veriVoteMain.waitForDeployment();

    // Register owner as admin first
    await voterRegistry.registerVoter(owner.address, "OWNER001", "Owner", 2); // Admin

    // Register other users
    await voterRegistry.registerVoter(admin.address, "admin001", "Admin Joko", 2); // Admin
    await voterRegistry.registerVoter(operator.address, "operator001", "Operator Budi", 1); // Operator
    await voterRegistry.registerVoter(voter1.address, "user001", "Acep", 0); // User
    await voterRegistry.registerVoter(voter2.address, "user002", "Budi Santoso", 0); // User
    await voterRegistry.registerVoter(voter3.address, "user003", "Citra Dewi", 0); // User
  });

  describe("VoterRegistry", function () {
    it("should register voters correctly", async function () {
      const voter = await voterRegistry.getVoterByAddress(voter1.address);
      expect(voter.nim).to.equal("user001");
      expect(voter.name).to.equal("Acep");
      expect(voter.isRegistered).to.be.true;
    });

    it("should not allow duplicate NIM registration", async function () {
      const [, , , , , , , newSigner] = await ethers.getSigners();
      await expect(
        voterRegistry.registerVoter(newSigner.address, "user001", "Duplicate", 0)
      ).to.be.revertedWith("VoterRegistry: NIM already registered");
    });

    it("should not allow duplicate address registration", async function () {
      await expect(
        voterRegistry.registerVoter(voter1.address, "newNim", "Duplicate", 0)
      ).to.be.revertedWith("VoterRegistry: voter already registered");
    });

    it("should look up voters by NIM", async function () {
      const voter = await voterRegistry.getVoterByNim("user001");
      expect(voter.name).to.equal("Acep");
    });

    it("should update voter roles", async function () {
      await voterRegistry.updateVoterRole(voter1.address, 1); // Promote to Operator
      const role = await voterRegistry.getVoterRole(voter1.address);
      expect(role).to.equal(1);
    });

    it("should track total voters", async function () {
      const count = await voterRegistry.getVoterCount();
      expect(count).to.equal(6); // owner + admin + operator + 3 voters
    });

    it("should remove voters", async function () {
      await voterRegistry.removeVoter(voter3.address);
      const count = await voterRegistry.getVoterCount();
      expect(count).to.equal(5);
    });

    it("should batch register voters", async function () {
      const signers = await ethers.getSigners();
      const newSigners = signers.slice(7, 10);
      
      await voterRegistry.batchRegisterVoters(
        newSigners.map(s => s.address),
        ["batch001", "batch002", "batch003"],
        ["Batch User 1", "Batch User 2", "Batch User 3"],
        [0, 0, 0]
      );

      const count = await voterRegistry.getVoterCount();
      expect(count).to.equal(9);
    });

    it("should not allow non-admin to register voters", async function () {
      const [, , , , , , , newSigner] = await ethers.getSigners();
      await expect(
        voterRegistry.connect(voter1).registerVoter(newSigner.address, "test001", "Test", 0)
      ).to.be.revertedWith("VoterRegistry: caller is not an admin");
    });
  });

  describe("VeriVoteMain - Election Management", function () {
    let electionId: number;

    beforeEach(async function () {
      // Create an election
      const tx = await veriVoteMain.createElection(
        "Pemilihan Ketua BEM",
        "Pemilihan Ketua BEM periode 2026-2027",
        500
      );
      await tx.wait();
      electionId = 1;
    });

    it("should create elections", async function () {
      const election = await veriVoteMain.getElection(electionId);
      expect(election.title).to.equal("Pemilihan Ketua BEM");
      expect(election.status).to.equal(0); // Draft
      expect(election.totalVoters).to.equal(500);
    });

    it("should add candidates", async function () {
      await veriVoteMain.addCandidate(electionId, "Ahmad Fauzi", "Calon 1", "");
      await veriVoteMain.addCandidate(electionId, "Diana Putri", "Calon 2", "");

      const candidates = await veriVoteMain.getAllCandidates(electionId);
      expect(candidates.length).to.equal(2);
      expect(candidates[0].name).to.equal("Ahmad Fauzi");
      expect(candidates[1].name).to.equal("Diana Putri");
    });

    it("should not add candidates to non-draft elections", async function () {
      await veriVoteMain.addCandidate(electionId, "Candidate A", "Desc", "");
      await veriVoteMain.addCandidate(electionId, "Candidate B", "Desc", "");
      await veriVoteMain.startElection(electionId, 3600);

      await expect(
        veriVoteMain.addCandidate(electionId, "Late Candidate", "Desc", "")
      ).to.be.revertedWith("VeriVote: election is not in draft");
    });

    it("should start elections with at least 2 candidates", async function () {
      await veriVoteMain.addCandidate(electionId, "Candidate A", "Desc", "");
      
      await expect(
        veriVoteMain.startElection(electionId, 3600)
      ).to.be.revertedWith("VeriVote: need at least 2 candidates");

      await veriVoteMain.addCandidate(electionId, "Candidate B", "Desc", "");
      await veriVoteMain.startElection(electionId, 3600);

      const election = await veriVoteMain.getElection(electionId);
      expect(election.status).to.equal(1); // Ongoing
    });

    it("should not allow non-admin to create elections", async function () {
      await expect(
        veriVoteMain.connect(voter1).createElection("Test", "Test", 100)
      ).to.be.revertedWith("VeriVote: caller is not an admin");
    });
  });

  describe("VeriVoteMain - Voting", function () {
    let electionId: number;

    beforeEach(async function () {
      electionId = 1;
      
      // Create election with candidates and start it
      await veriVoteMain.createElection("Pemilihan Ketua BEM", "Test election", 500);
      await veriVoteMain.addCandidate(electionId, "Ahmad Fauzi", "Calon 1", "");
      await veriVoteMain.addCandidate(electionId, "Diana Putri", "Calon 2", "");
      await veriVoteMain.addCandidate(electionId, "Rizki Pratama", "Calon 3", "");
      await veriVoteMain.startElection(electionId, 7 * 24 * 3600); // 7 days
    });

    it("should allow registered voters to cast votes", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1);
      
      const voted = await veriVoteMain.hasVoterVoted(electionId, voter1.address);
      expect(voted).to.be.true;

      const election = await veriVoteMain.getElection(electionId);
      expect(election.totalVotes).to.equal(1);
    });

    it("should not allow double voting", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1);
      
      await expect(
        veriVoteMain.connect(voter1).castVote(electionId, 2)
      ).to.be.revertedWith("VeriVote: already voted");
    });

    it("should not allow unregistered voters to vote", async function () {
      await expect(
        veriVoteMain.connect(unregistered).castVote(electionId, 1)
      ).to.be.revertedWith("VeriVote: caller is not a registered voter");
    });

    it("should track vote counts per candidate", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1); // Ahmad
      await veriVoteMain.connect(voter2).castVote(electionId, 1); // Ahmad
      await veriVoteMain.connect(voter3).castVote(electionId, 2); // Diana

      const candidate1 = await veriVoteMain.getCandidate(electionId, 1);
      const candidate2 = await veriVoteMain.getCandidate(electionId, 2);
      
      expect(candidate1.voteCount).to.equal(2);
      expect(candidate2.voteCount).to.equal(1);
    });

    it("should generate vote verification hash", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1);
      
      const hash = await veriVoteMain.getVoteVerification(electionId, voter1.address);
      expect(hash).to.not.equal(ethers.ZeroHash);
    });

    it("should calculate participation rate", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1);
      await veriVoteMain.connect(voter2).castVote(electionId, 2);

      const rate = await veriVoteMain.getParticipationRate(electionId);
      // 2/500 = 0.004 = 40 basis points
      expect(rate).to.equal(40);
    });

    it("should return election results after completion", async function () {
      await veriVoteMain.connect(voter1).castVote(electionId, 1);
      await veriVoteMain.connect(voter2).castVote(electionId, 1);
      await veriVoteMain.connect(voter3).castVote(electionId, 2);

      // End election
      await veriVoteMain.endElection(electionId);

      const results = await veriVoteMain.getElectionResults(electionId);
      expect(results[0].name).to.equal("Ahmad Fauzi"); // Winner
      expect(results[0].voteCount).to.equal(2);
      expect(results[1].name).to.equal("Diana Putri");
      expect(results[1].voteCount).to.equal(1);
    });

    it("should not return results before election completes", async function () {
      await expect(
        veriVoteMain.getElectionResults(electionId)
      ).to.be.revertedWith("VeriVote: election not yet completed");
    });

    it("should not allow voting on draft elections", async function () {
      await veriVoteMain.createElection("Draft Election", "Test", 100);
      await veriVoteMain.addCandidate(2, "A", "Desc", "");
      
      await expect(
        veriVoteMain.connect(voter1).castVote(2, 1)
      ).to.be.revertedWith("VeriVote: election is not ongoing");
    });

    it("should check if election is active", async function () {
      const active = await veriVoteMain.isElectionActive(electionId);
      expect(active).to.be.true;
    });
  });
});
