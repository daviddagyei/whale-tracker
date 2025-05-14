// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fetch = require('node-fetch');
const { ETH_BSC_QUERY, BITCOIN_QUERY, SOLANA_QUERY } = require('./bitquery-templates');
const { createClient } = require('@supabase/supabase-js');
const { sendAlertEmail } = require('./email');

// Setup Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

const BITQUERY_API_KEY = process.env.BITQUERY_API_KEY;
const ENDPOINT = 'https://graphql.bitquery.io/';

// Simple in-memory cache for last seen timestamp/hash per chain
const lastSeen = {
  ethereum: null,
  bsc: null,
  bitcoin: null,
  solana: null,
};

// In-memory cache for whale transactions (to be filled by polling logic)
let whaleCache = {
  ETH: [],
  BSC: [],
  BTC: [],
  SOL: []
};

// In-memory set to prevent duplicate alerts (cleared every 6 hours)
const alertedTxs = new Set();
setInterval(() => alertedTxs.clear(), 6 * 60 * 60 * 1000); // clear every 6 hours

// Helper to convert UTC ISO string to CST (Central Standard Time, UTC-6)
function toCST(isoString) {
  const date = new Date(isoString);
  // CST is UTC-6, but for daylight saving, you may want CDT (UTC-5)
  // Here we use UTC-6 always for simplicity
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const cst = new Date(utc - (6 * 60 * 60 * 1000));
  return cst.toISOString().replace('T', ' ').replace('Z', ' CST');
}

// Helper: get all subscribers from Supabase
async function getSubscribers() {
  const { data, error } = await supabase.from('subscriptions').select('email, threshold');
  if (error) {
    console.error('Error fetching subscribers:', error.message);
    return [];
  }
  return data || [];
}

// Helper: process and alert for new transactions
async function processAndAlert(chain, txs) {
  if (!txs.length) return;
  const subscribers = await getSubscribers();
  for (const tx of txs) {
    // Compose a unique key for deduplication
    const txKey = `${chain}:${tx.txHash || tx.signature || tx.hash}`;
    if (alertedTxs.has(txKey)) continue;
    for (const sub of subscribers) {
      if (Number(tx.amount) >= Number(sub.threshold)) {
        try {
          await sendAlertEmail(sub.email, {
            chain,
            amount: tx.amount,
            sender: tx.sender?.address || tx.address || '',
            receiver: tx.receiver?.address || '',
            timestamp: tx.block?.timestamp?.time || tx.timestamp || '',
            txHash: tx.txHash || tx.signature || tx.hash || ''
          });
          console.log(`Alert sent to ${sub.email} for ${chain} tx ${txKey}`);
        } catch (err) {
          console.error(`Failed to send alert to ${sub.email}:`, err.message);
        }
      }
    }
    alertedTxs.add(txKey);
  }
}

// Update polling functions to call processAndAlert and update whaleCache
async function fetchEthOrBsc(network) {
  // Always fetch the last 10 minutes (rolling window)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const variables = {
    network,
    minAmount: network === 'ethereum' ? 100 : 100, // 100 ETH or 100 BNB for production
    since,
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BITQUERY_API_KEY}`,
    },
    body: JSON.stringify({ query: ETH_BSC_QUERY, variables }),
  });
  const data = await res.json();
  const txs = data.data?.ethereum?.transfers || [];
  // Deduplicate by txHash (in-memory set)
  const seen = new Set();
  const deduped = txs.filter(tx => {
    const key = tx.transaction?.hash;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  whaleCache[network.toUpperCase()] = deduped.map(tx => ({
    chain: network.toUpperCase(),
    amount: tx.amount,
    sender: tx.sender?.address,
    receiver: tx.receiver?.address,
    timestamp: toCST(tx.block?.timestamp?.time),
    txHash: tx.transaction?.hash
  }));
  await processAndAlert(network.toUpperCase(), whaleCache[network.toUpperCase()]);
  console.log(`\n[${network.toUpperCase()}] New transfers:`);
  deduped.forEach(tx => console.log(tx));
}

async function fetchSolana() {
  // Always fetch the last 10 minutes (rolling window)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const variables = {
    minAmount: 10000, // 10,000 SOL for production
    since,
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BITQUERY_API_KEY}`,
    },
    body: JSON.stringify({ query: SOLANA_QUERY, variables }),
  });
  const data = await res.json();
  const txs = data.data?.solana?.transfers || [];
  // Deduplicate by signature
  const seen = new Set();
  const deduped = txs.filter(tx => {
    const key = tx.transaction?.signature;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  whaleCache.SOL = deduped.map(tx => ({
    chain: 'SOL',
    amount: tx.amount,
    sender: tx.sender?.address,
    receiver: tx.receiver?.address,
    timestamp: toCST(tx.block?.timestamp?.time),
    txHash: tx.transaction?.signature
  }));
  await processAndAlert('SOL', whaleCache.SOL);
  console.log(`\n[SOLANA] New transfers:`);
  deduped.forEach(tx => console.log(tx));
}

async function fetchBitcoin() {
  // Always fetch the last 10 minutes (rolling window)
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const variables = { since };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BITQUERY_API_KEY}`,
    },
    body: JSON.stringify({ query: BITCOIN_QUERY, variables }),
  });
  const data = await res.json();
  const minAmount = 100; // 100 BTC for production
  const outputs = data.data?.bitcoin?.outputs || [];
  // Filter by value in code and deduplicate by tx hash
  const seen = new Set();
  const filtered = outputs.filter(o => o.value > minAmount && !seen.has(o.transaction?.hash) && seen.add(o.transaction?.hash));
  whaleCache.BTC = filtered.map(tx => ({
    chain: 'BTC',
    amount: tx.value,
    sender: '',
    receiver: '',
    timestamp: toCST(tx.block?.timestamp?.time),
    txHash: tx.transaction?.hash
  }));
  await processAndAlert('BTC', whaleCache.BTC);
  console.log(`\n[BITCOIN] New outputs:`);
  filtered.forEach(tx => console.log(tx));
}

// Polling scheduler
setInterval(() => fetchEthOrBsc('ethereum'), 30000); // every 30s
setInterval(() => fetchEthOrBsc('bsc'), 35000);      // every 35s
setInterval(fetchBitcoin, 40000);                    // every 40s
setInterval(fetchSolana, 45000);                     // every 45s

// Root route for health check or welcome
app.get('/', (req, res) => {
  res.send('Whale Tracker backend is running.');
});

// GET /transactions?chain=ETH
app.get('/transactions', (req, res) => {
  const { chain } = req.query;
  let allTxs = Object.values(whaleCache).flat();
  if (chain) {
    allTxs = allTxs.filter(tx => tx.chain === chain);
  }
  // Deduplicate by chain+txHash
  const seen = new Set();
  const deduped = allTxs.filter(tx => {
    const key = `${tx.chain}:${tx.txHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // Sort by timestamp descending
  deduped.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(deduped);
});

// POST /subscribe { email, threshold }
app.post('/subscribe', async (req, res) => {
  const { email, threshold } = req.body;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  const numThreshold = Number(threshold);
  if (isNaN(numThreshold) || numThreshold <= 0) {
    return res.status(400).json({ error: 'Invalid threshold' });
  }
  // Upsert subscription (unique by email)
  const { error } = await supabase
    .from('subscriptions')
    .upsert({ email, threshold: numThreshold }, { onConflict: ['email'] });
  if (error) {
    return res.status(500).json({ error: 'Database error', details: error.message, supabase: error });
  }
  res.json({ success: true });
});

// Test route to send a sample alert email
app.post('/test-email', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  const fakeTx = {
    chain: 'ETH',
    amount: 123.45,
    sender: '0xabc...123',
    receiver: '0xdef...456',
    timestamp: new Date().toISOString(),
    txHash: '0xhash1'
  };
  try {
    await sendAlertEmail(email, fakeTx);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
