// Test Bitquery GraphQL queries for each chain
require('dotenv').config();
const fetch = require('node-fetch');
const { ETH_BSC_QUERY, BITCOIN_QUERY, SOLANA_QUERY } = require('./bitquery-templates');

const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;
const ENDPOINT = 'https://graphql.bitquery.io/';

async function runQuery(query, variables, label) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BITQUERY_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  let text = await res.text();
  try {
    const data = JSON.parse(text);
    console.log(`\n=== ${label} ===`);
    console.dir(data, { depth: 6 });
  } catch (err) {
    console.log(`\n=== ${label} (RAW RESPONSE) ===`);
    console.log(text);
    throw err;
  }
}

(async () => {
  // Test Ethereum
  await runQuery(ETH_BSC_QUERY, {
    network: 'ethereum',
    minAmount: 0.1, // low threshold for test
    since: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // last 1 hour
  }, 'Ethereum');

  // Test BSC
  await runQuery(ETH_BSC_QUERY, {
    network: 'bsc',
    minAmount: 0.1,
    since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  }, 'BSC');

  // Test Bitcoin (filter by value in code)
  const btcRes = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BITQUERY_API_KEY}`,
    },
    body: JSON.stringify({
      query: BITCOIN_QUERY,
      variables: {
        since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
    }),
  });
  const btcText = await btcRes.text();
  try {
    const btcData = JSON.parse(btcText);
    const minAmount = 0.01; // BTC
    const filtered = btcData.data?.bitcoin?.outputs?.filter(o => o.value > minAmount) || [];
    console.log('\n=== Bitcoin (filtered in code) ===');
    console.dir(filtered, { depth: 6 });
  } catch (err) {
    console.log('\n=== Bitcoin (RAW RESPONSE) ===');
    console.log(btcText);
  }

  // Test Solana
  await runQuery(SOLANA_QUERY, {
    minAmount: 1, // SOL
    since: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  }, 'Solana');
})();

// Notes:
// - Bitcoin query uses outputs, so may need deduplication in production.
// - Adjust minAmount for more or fewer results.
// - If Solana returns empty, check Bitquery docs for latest schema.
