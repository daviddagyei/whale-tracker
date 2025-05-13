// Bitquery GraphQL query templates for Whale Tracker
// Each query is a string template with a placeholder for the threshold amount
// Adjusted for Bitquery's schema and free tier limits

// ETHEREUM (and BSC, with network param)
const ETH_BSC_QUERY = `
query ($network: EthereumNetwork!, $minAmount: Float!, $since: ISO8601DateTime) {
  ethereum(network: $network) {
    transfers(
      options: {desc: "block.timestamp.time", limit: 10}
      date: {since: $since}
      amount: {gt: $minAmount}
      currency: {is: "ETH"}
    ) {
      block { timestamp { time } }
      transaction { hash }
      sender { address }
      receiver { address }
      amount
      currency { symbol }
    }
  }
}`;

// BITCOIN
const BITCOIN_QUERY = `
query ($since: ISO8601DateTime) {
  bitcoin {
    outputs(
      options: {desc: "block.timestamp.time", limit: 10}
      date: {since: $since}
    ) {
      block { timestamp { time } }
      transaction { hash }
      value
    }
  }
}`;
// Note: Bitcoin outputs may result in duplicate txs if multiple large outputs in one tx. Deduplicate in code if needed. Filtering by value must be done in code.

// SOLANA
const SOLANA_QUERY = `
query ($minAmount: Float!, $since: ISO8601DateTime) {
  solana {
    transfers(
      options: {desc: "block.timestamp.time", limit: 10}
      amount: {gt: $minAmount}
      date: {since: $since}
      currency: {is: "SOL"}
    ) {
      block { timestamp { time } }
      transaction { signature }
      sender { address }
      receiver { address }
      amount
      currency { symbol }
    }
  }
}`;

module.exports = {
  ETH_BSC_QUERY,
  BITCOIN_QUERY,
  SOLANA_QUERY
};
