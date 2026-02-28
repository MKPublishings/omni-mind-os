// Example usage of the HTTP client
// Run this file with: node ./src/utils/httpClientExample.js

import { httpGet, httpPost } from './httpClient.js';

async function testHttp() {
  try {
    // Example GET request
    const data = await httpGet('https://api.github.com');
    console.log('GET response:', data);

    // Example POST request (to a public echo API)
    const postData = await httpPost('https://postman-echo.com/post', { hello: 'world' });
    console.log('POST response:', postData);
  } catch (err) {
    console.error('HTTP error:', err);
  }
}

testHttp();
