async function testVote() {
  try {
    console.log("Logging in...");
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nim: "user001", password: "user123" })
    });
    const loginData: any = await loginRes.json();
    const token = loginData.data.token;
    const wallet = loginData.data.user.wallet_address;
    console.log("Logged in. Wallet:", wallet);

    console.log("Checking if registered on blockchain...");
    const electionsRes = await fetch("http://localhost:3000/api/elections", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const electionsData: any = await electionsRes.json();
    const electionId = electionsData.data.find((e: any) => e.status === "ongoing")?.id || 1;
    console.log("Found ongoing election ID:", electionId);

    console.log("Casting vote...");
    const voteRes = await fetch(`http://localhost:3000/api/vote/${electionId}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ candidateId: 1 })
    });
    const voteData: any = await voteRes.json();
    console.log("Vote result:", voteData);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testVote();
