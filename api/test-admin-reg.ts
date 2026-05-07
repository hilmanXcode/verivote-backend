async function testAdminRegister() {
  try {
    console.log("Logging in as Admin...");
    const loginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nim: "admin001", password: "admin123" })
    });
    const loginData: any = await loginRes.json();
    const adminToken = loginData.data.token;

    console.log("Registering new user via Admin UI endpoint...");
    const regRes = await fetch("http://localhost:3000/api/users", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ 
        nim: "newuser777", 
        name: "Test Admin New User", 
        password: "password123",
        role: "user"
      })
    });
    const regData: any = await regRes.json();
    console.log("Register response:", regData);

    if (!regData.success) return;

    console.log("Logging in as new user...");
    const newLoginRes = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nim: "newuser777", password: "password123" })
    });
    const newLoginData: any = await newLoginRes.json();
    const newToken = newLoginData.data.token;

    console.log("Casting vote...");
    const voteRes = await fetch(`http://localhost:3000/api/vote/2`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`
      },
      body: JSON.stringify({ candidateId: 1 })
    });
    const voteData: any = await voteRes.json();
    console.log("Vote result:", voteData);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testAdminRegister();
