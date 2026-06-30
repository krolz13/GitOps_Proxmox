const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Home page
app.get('/', (req, res) => {
  res.render('index', { title: 'Home' });
});

// About page
app.get('/about', (req, res) => {
  res.render('about', { title: 'About' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://0.0.0.0:${PORT}`);
});