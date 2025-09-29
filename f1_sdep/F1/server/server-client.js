// server-client.js
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clientRoutes');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'..', 'public')));

app.use('/', authRoutes);        // Login e registrazione comuni
app.use('/', clientRoutes);     // Rotte utente (biglietti, classifiche, piloti, ecc.)

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato (Client)' });
});

app.listen(3000, () => {
    console.log('🟢 Server CLIENT in ascolto su http://localhost:3000');
});
