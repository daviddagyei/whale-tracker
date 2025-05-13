// Express app entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
app.use(express.json());
app.use(cors());
app.use(helmet());

// Placeholder routes
app.get('/transactions', (req, res) => {
  res.json({ message: 'Transactions endpoint placeholder' });
});

app.post('/subscribe', (req, res) => {
  res.json({ message: 'Subscribe endpoint placeholder' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
