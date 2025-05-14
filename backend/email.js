// SendGrid email utility for Whale Tracker
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

/**
 * Send a whale alert email
 * @param {string} email - recipient
 * @param {object} tx - transaction object
 * @returns {Promise<void>}
 */
async function sendAlertEmail(email, tx) {
  const msg = {
    to: email,
    from: process.env.SENDGRID_FROM_EMAIL, // Use a verified sender from env
    subject: `Whale Alert: ${tx.amount} ${tx.chain} transfer detected!`,
    text: `A whale transfer was detected:\n\nChain: ${tx.chain}\nAmount: ${tx.amount}\nSender: ${tx.sender}\nReceiver: ${tx.receiver}\nTimestamp: ${tx.timestamp}\nTx Hash: ${tx.txHash}\n\nThis is an automated alert from Whale Tracker.`,
    html: `<h2>Whale Alert</h2><p><b>Chain:</b> ${tx.chain}<br/><b>Amount:</b> ${tx.amount}<br/><b>Sender:</b> ${tx.sender}<br/><b>Receiver:</b> ${tx.receiver}<br/><b>Timestamp:</b> ${tx.timestamp}<br/><b>Tx Hash:</b> ${tx.txHash}</p><p>This is an automated alert from Whale Tracker.</p>`
  };
  await sgMail.send(msg);
}

module.exports = { sendAlertEmail };
