import { getVoterRegistryContract, initBlockchain } from "./src/config/blockchain";

async function testDirectReg() {
  await initBlockchain();
  const reg = getVoterRegistryContract();
  
  const wallet = "0xB79B20FD6855aC00Cdd1035f7cfea5Ad52849254";
  console.log("Trying to register...");
  try {
    const tx = await reg.registerVoter(wallet, "newuser999", "Test", 0);
    const receipt = await tx.wait();
    console.log("Success! Hash:", receipt.hash);
  } catch (err: any) {
    console.error("Direct Register Error:", err);
  }
}

testDirectReg();
