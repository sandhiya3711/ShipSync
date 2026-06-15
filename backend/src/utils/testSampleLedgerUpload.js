const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('Reading sample_ledger.xlsx from workspace root...');

const rootPath = path.resolve(__dirname, '..', '..', '..');
const filePath = path.join(rootPath, 'sample_ledger.xlsx');

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found at ${filePath}`);
  process.exit(1);
}

const excelBuffer = fs.readFileSync(filePath);
console.log('Excel file size:', excelBuffer.length, 'bytes');

// 1. Log in to get the JWT token
const loginData = JSON.stringify({
  username: 'sakthi vignessh',
  password: '0307'
});

const loginOptions = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': loginData.length
  }
};

const req = http.request(loginOptions, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    if (res.statusCode !== 200) {
      console.error('Login failed:', body);
      return;
    }
    
    const token = JSON.parse(body).token;
    console.log('Login successful. Token obtained.');
    
    // 2. Perform multipart form-data upload
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    
    const filename = 'sample_ledger.xlsx';
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const totalLength = Buffer.byteLength(header) + excelBuffer.length + Buffer.byteLength(footer);
    
    const uploadOptions = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/excel/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': totalLength
      }
    };
    
    const uploadReq = http.request(uploadOptions, (uploadRes) => {
      let uploadBody = '';
      uploadRes.on('data', (chunk) => uploadBody += chunk);
      uploadRes.on('end', () => {
        console.log('Upload response status:', uploadRes.statusCode);
        console.log('Upload response body:', uploadBody);
      });
    });
    
    uploadReq.on('error', (err) => console.error('Upload request error:', err));
    
    // Write multipart parts
    uploadReq.write(Buffer.from(header));
    uploadReq.write(excelBuffer);
    uploadReq.write(Buffer.from(footer));
    uploadReq.end();
  });
});

req.on('error', (err) => console.error('Login request error:', err));
req.write(loginData);
req.end();
