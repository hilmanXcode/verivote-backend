async function testRegisterAndVote() {
  try {
    console.log("Registering new user...");
    const regRes = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        nim: "newuser998", 
        name: "Test New User", 
        password: "password123",
        role: "user"
      })
    });
    const regData: any = await regRes.json();
    console.log("Register response:", regData);

    if (!regData.success) return;

    const token = regData.data.token;
    const wallet = regData.data.user.wallet_address;
    console.log("New user wallet:", wallet);

    console.log("Casting vote...");
    const voteRes = await fetch(`http://localhost:3000/api/vote/2`, {
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

testRegisterAndVote();
