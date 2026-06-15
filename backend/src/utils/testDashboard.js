const http = require('http');

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
    
    const endpoints = [
      '/api/dashboard/metrics',
      '/api/excel/companies',
      '/api/billing/slabs',
      '/api/billing/zones',
      '/api/billing/fuzzy-companies'
    ];
    
    endpoints.forEach(path => {
      const opt = {
        hostname: 'localhost',
        port: 5000,
        path: path,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      };
      
      const subReq = http.request(opt, (subRes) => {
        let subBody = '';
        subRes.on('data', (chunk) => subBody += chunk);
        subRes.on('end', () => {
          console.log(`Endpoint ${path} returned status ${subRes.statusCode}`);
          if (subRes.statusCode !== 200) {
            console.error(`ERROR on ${path}:`, subBody);
          }
        });
      });
      subReq.end();
    });
  });
});

req.write(loginData);
req.end();
