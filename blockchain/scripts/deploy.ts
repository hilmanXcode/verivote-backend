import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("─".repeat(60));

  // 1. Deploy VoterRegistry
  console.log("\n📋 Deploying VoterRegistry...");
  const VoterRegistry = await ethers.getContractFactory("VoterRegistry");
  const voterRegistry = await VoterRegistry.deploy();
  await voterRegistry.waitForDeployment();
  const voterRegistryAddress = await voterRegistry.getAddress();
  console.log("✅ VoterRegistry deployed to:", voterRegistryAddress);

  // 2. Deploy VeriVoteMain with VoterRegistry address
  console.log("\n🗳️  Deploying VeriVoteMain...");
  const VeriVoteMain = await ethers.getContractFactory("VeriVoteMain");
  const veriVoteMain = await VeriVoteMain.deploy(voterRegistryAddress);
  await veriVoteMain.waitForDeployment();
  const veriVoteMainAddress = await veriVoteMain.getAddress();
  console.log("✅ VeriVoteMain deployed to:", veriVoteMainAddress);

  // 3. Register deployer as admin in VoterRegistry
  console.log("\n👤 Registering deployer as admin...");
  await voterRegistry.registerVoter(
    deployer.address,
    "ADMIN001",
    "Admin VeriVote",
    2 // Role.Admin
  );
  console.log("✅ Deployer registered as Admin");

  // 4. Seed demo data
  console.log("\n🌱 Seeding demo data...");
  
  // Get additional signers for demo accounts
  const signers = await ethers.getSigners();
  
  if (signers.length >= 5) {
    // Register demo users
    // Removed hardcoded demo users because they conflict with api/src/scripts/seed.ts
    // which generates proper random wallets for the database users.

    // Create a demo election
    console.log("\n🗳️  Creating demo election...");
    const tx = await veriVoteMain.createElection(
      "Pemilihan Ketua BEM 2026",
      "Pemilihan Ketua Badan Eksekutif Mahasiswa periode 2026-2027. Seluruh mahasiswa aktif berhak memberikan suaranya.",
      500
    );
    await tx.wait();
    console.log("  ✅ Created: Pemilihan Ketua BEM 2026");

    // Add candidates
    await veriVoteMain.addCandidate(1, "Ahmad Fauzi", "Calon 1 - Visi: Kampus Digital", "");
    await veriVoteMain.addCandidate(1, "Diana Putri", "Calon 2 - Visi: Kampus Inklusif", "");
    await veriVoteMain.addCandidate(1, "Rizki Pratama", "Calon 3 - Visi: Kampus Inovatif", "");
    console.log("  ✅ Added 3 candidates");

    // Create second election (already started)
    await veriVoteMain.createElection(
      "Pemilihan Ketua HIMA Informatika",
      "Pemilihan Ketua Himpunan Mahasiswa Informatika periode 2026-2027.",
      1500
    );
    await veriVoteMain.addCandidate(2, "Sari Dewi", "Calon 1 - Program kerja: Tech Community", "");
    await veriVoteMain.addCandidate(2, "Hendra Wijaya", "Calon 2 - Program kerja: Networking Events", "");
    
    // Start the second election (7 days duration)
    await veriVoteMain.startElection(2, 7 * 24 * 60 * 60);
    console.log("  ✅ Created & started: Pemilihan Ketua HIMA Informatika");
  }

  // 5. Save deployment info for the API
  console.log("\n💾 Saving deployment info...");
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    contracts: {
      VoterRegistry: {
        address: voterRegistryAddress,
        abi: JSON.parse(VoterRegistry.interface.formatJson()),
      },
      VeriVoteMain: {
        address: veriVoteMainAddress,
        abi: JSON.parse(VeriVoteMain.interface.formatJson()),
      },
    },
    deployedAt: new Date().toISOString(),
  };

  const deploymentPath = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(deploymentPath, "localhost.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Deployment info saved to deployments/localhost.json");

  // Also save to API config directory
  const apiConfigPath = path.join(__dirname, "..", "..", "api", "src", "config");
  if (!fs.existsSync(apiConfigPath)) {
    fs.mkdirSync(apiConfigPath, { recursive: true });
  }

  fs.writeFileSync(
    path.join(apiConfigPath, "contracts.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("✅ Contract ABIs copied to API config");

  console.log("\n" + "═".repeat(60));
  console.log("🎉 Deployment complete!");
  console.log("═".repeat(60));
  console.log(`\nVoterRegistry: ${voterRegistryAddress}`);
  console.log(`VeriVoteMain:  ${veriVoteMainAddress}`);
  console.log("\nNext steps:");
  console.log("  1. Start API server: cd ../api && npm run dev");
  console.log("  2. Use mobile app to connect via API");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
