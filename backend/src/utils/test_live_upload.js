const fs = require('fs');

async function main() {
  const fileBuf = fs.readFileSync('C:/Users/sandh/Downloads/MAY-2026.xlsx');
  
  // 1. Login to get token
  console.log("Logging in...");
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const { token } = await loginRes.json();
  console.log("Logged in successfully. Token obtained.");

  // 2. Prepare multipart upload
  const formData = new FormData();
  const fileBlob = new Blob([fileBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  formData.append('file', fileBlob, 'MAY-2026.xlsx');

  // 3. Send upload request
  console.log("Uploading MAY-2026.xlsx...");
  const uploadRes = await fetch('http://localhost:5000/api/excel/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  console.log(`Response Status: ${uploadRes.status}`);
  const resText = await uploadRes.text();
  console.log("Response Body:");
  console.log(resText);
}

main().catch(console.error);
