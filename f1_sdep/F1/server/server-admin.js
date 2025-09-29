// server-admin.js
const express = require('express');
const path = require('path');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname,'..', 'public')));

app.use('/', authRoutes);          // Login condiviso (anche admin)
app.use('/admin', adminRoutes);   // Rotte riservate agli admin

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint non trovato (Admin)' });
});

app.listen(3001, () => {
    console.log('🔴 Server ADMIN in ascolto su http://localhost:3001');
});
