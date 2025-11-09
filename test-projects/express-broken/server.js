const express = require('express');
const app = express();

// Hardcoded port - will fail on Railway!
const port = 3000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Binding to localhost - won't work on Railway!
app.listen(port, 'localhost', () => {
  console.log(`Server running on http://localhost:${port}`);
});
