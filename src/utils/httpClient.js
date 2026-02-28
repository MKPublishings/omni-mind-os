// omni-ai/src/utils/httpClient.js
// Basic HTTP client using node-fetch for internet access

import fetch from 'node-fetch';

/**
 * Makes an HTTP GET request to the specified URL.
 * @param {string} url - The URL to fetch.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<any>} - The response data.
 */
export async function httpGet(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Makes an HTTP POST request to the specified URL.
 * @param {string} url - The URL to post to.
 * @param {object} body - The body to send.
 * @param {object} [options] - Optional fetch options.
 * @returns {Promise<any>} - The response data.
 */
export async function httpPost(url, body, options = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: JSON.stringify(body),
    ...options,
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
