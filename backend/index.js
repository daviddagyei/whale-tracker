// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fetch = require('node-fetch');
const { ETH_BSC_QUERY, BITCOIN_QUERY, SOLANA_QUERY } = require('./bitquery-templates');
const { createClient } = require('@supabase/supabase-js');

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

// Example: Dummy data for demonstration
whaleCache.ETH = [
  {
    chain: 'ETH',
    amount: 123.45,
    sender: '0xabc...123',
    receiver: '0xdef...456',
    timestamp: new Date().toISOString(),
    txHash: '0xhash1'
  }
];
whaleCache.BTC = [
  {
    chain: 'BTC',
    amount: 10.5,
    sender: '1A1zP1...',
    receiver: '1BvBMSE...',
    timestamp: new Date().toISOString(),
    txHash: '0xhash2'
  }
];

async function fetchEthOrBsc(network) {
  const since = lastSeen[network] || new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const variables = {
    network,
    minAmount: 0.1, // Example threshold for demo
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
  if (txs.length > 0) {
    lastSeen[network] = txs[0].block.timestamp.time;
    console.log(`\n[${network.toUpperCase()}] New transfers:`);
    txs.forEach(tx => console.log(tx));
  }
}

async function fetchSolana() {
  const since = lastSeen.solana || new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const variables = {
    minAmount: 1, // Example threshold
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
  if (txs.length > 0) {
    lastSeen.solana = txs[0].block.timestamp.time;
    console.log(`\n[SOLANA] New transfers:`);
    txs.forEach(tx => console.log(tx));
  }
}

async function fetchBitcoin() {
  const since = lastSeen.bitcoin || new Date(Date.now() - 10 * 60 * 1000).toISOString();
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
  const minAmount = 0.01; // Example threshold
  const outputs = data.data?.bitcoin?.outputs || [];
  // Filter by value in code
  const filtered = outputs.filter(o => o.value > minAmount);
  if (filtered.length > 0) {
    lastSeen.bitcoin = filtered[0].block.timestamp.time;
    console.log(`\n[BITCOIN] New outputs:`);
    filtered.forEach(tx => console.log(tx));
  }
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
  // Sort by timestamp descending
  allTxs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  res.json(allTxs);
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
