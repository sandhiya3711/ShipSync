const http = require('http');
const xlsx = require('xlsx');

console.log('Generating dummy Excel sheet buffer...');

// Generate a valid 1-row Excel sheet in-memory
const ws = xlsx.utils.json_to_sheet([{
  'Company Name': 'Alfred Pvt Ltd',
  'Consignment Number': '3711',
  'Destination': 'Chennai',
  'Order Date': '2026-05-30',
  'Weight': 0.4
}]);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

console.log('Excel buffer generated. Size:', excelBuffer.length, 'bytes');

// 1. Log in to get the JWT token
const loginData = JSON.stringify({
  username: 'sakthi vignessh',
  password: '0307'
});

const loginOptions = {
  hostname: '127.0.0.1',
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
    
    // Construct multipart payload
    const filename = 'TEST_UPLOAD.xlsx';
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`;
    const footer = `\r\n--${boundary}--\r\n`;
    
    const totalLength = Buffer.byteLength(header) + excelBuffer.length + Buffer.byteLength(footer);
    
    const uploadOptions = {
      hostname: '127.0.0.1',
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
