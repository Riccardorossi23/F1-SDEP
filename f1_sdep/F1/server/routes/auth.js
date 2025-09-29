// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Redirect alla pagina di login
router.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Login
router.post('/login', (req, res) => {
    const { Email, Password } = req.body;

    if (!Email || !Password) {
        return res.status(400).json({ error: 'Email e Password sono obbligatori' });
    }

    if (Email === 'admin@f1.com' && Password === 'admin1234') {
        return res.json({
            message: 'Login amministratore effettuato con successo',
            user: {
                CartaIdentitàID: 'ADMIN001',
                Nome: 'Admin',
                Cognome: 'System',
                Email,
                Ruolo: 'admin'
            }
        });
    }

    const query = `SELECT * FROM Utenti WHERE Email = ? AND Password = ?`;

    db.query(query, [Email, Password], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(401).json({ error: 'Credenziali non valide' });

        const user = results[0];
        res.json({
            message: 'Login effettuato con successo',
            user: {
                CartaIdentitàID: user.CartaIdentitàID,
                Nome: user.Nome,
                Cognome: user.Cognome,
                Email: user.Email,
                Ruolo: user.Ruolo || 'user'
            }
        });
    });
});

// Registrazione
router.post('/utenti', (req, res) => {
    const { Nome, Cognome, Email, Password, CartaIdentitàID } = req.body;

    if (!Nome || !Cognome || !Email || !Password || !CartaIdentitàID) {
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    const query = `
        INSERT INTO Utenti (CartaIdentitàID, Nome, Cognome, Email, Password, DataRegistrazione)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [CartaIdentitàID, Nome, Cognome, Email, Password, new Date()], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Codice Carta o Email già registrati' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Utente registrato con successo', codiceCarta: CartaIdentitàID });
    });
});

module.exports = router;
