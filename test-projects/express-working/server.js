const express = require('express');
const app = express();

// Use PORT from environment with fallback
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Bind to 0.0.0.0 for Railway
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
