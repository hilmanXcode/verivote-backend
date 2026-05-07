import { getVoterRegistryContract, initBlockchain } from "./src/config/blockchain";

async function verify() {
  await initBlockchain();
  const reg = getVoterRegistryContract();

  const wallet = "0xB79B20FD6855aC00Cdd1035f7cfea5Ad52849254";
  
  const isReg = await reg.isRegistered(wallet);
  console.log(`Is ${wallet} registered in VoterRegistry?`, isReg);
}

verify().catch(console.error);
