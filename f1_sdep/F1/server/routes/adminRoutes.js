// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Tutti i biglietti (visione admin)
router.get('/biglietti', (req, res) => {
    const query = `
        SELECT b.*, c.Nome AS NomeCircuito, c.Nazione, c.Giorno
        FROM BigliettiF1 b
        JOIN (
            SELECT CircuitoID, Nome, Nazione, Giorno
            FROM Circuiti
            WHERE (CircuitoID, Giorno) IN (
                SELECT CircuitoID, MAX(Giorno)
                FROM Circuiti
                GROUP BY CircuitoID
            )
        ) c ON b.GranPremioID = c.CircuitoID
        ORDER BY c.Giorno ASC, b.GranPremioID ASC, 
            CASE b.TipoPosto
                WHEN 'Paddock' THEN 1 
                WHEN 'Gradinate' THEN 2 
                WHEN 'Prato' THEN 3 
            END
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Biglietti completi con stato
router.get('/biglietti-completi', (req, res) => {
    const query = `
        SELECT 
            b.BigliettoID, b.GranPremioID, b.TipoPosto, b.Prezzo, b.Disponibilita,
            c.Nome AS NomeCircuito, c.Nazione, c.Giorno,
            CASE 
                WHEN c.Giorno < CURDATE() THEN 'passata'
                WHEN c.Giorno = CURDATE() THEN 'oggi'
                ELSE 'futura'
            END AS StatoGara
        FROM BigliettiF1 b
        JOIN (
            SELECT CircuitoID, Nome, Nazione, Giorno
            FROM Circuiti
            WHERE (CircuitoID, Giorno) IN (
                SELECT CircuitoID, MAX(Giorno)
                FROM Circuiti
                GROUP BY CircuitoID
            )
        ) c ON b.GranPremioID = c.CircuitoID
        ORDER BY c.Giorno ASC, b.GranPremioID ASC, 
            CASE b.TipoPosto 
                WHEN 'Paddock' THEN 1 
                WHEN 'Gradinate' THEN 2 
                WHEN 'Prato' THEN 3 
            END
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Modifica biglietto
router.put('/biglietti/:id', (req, res) => {
    const { id } = req.params;
    const { TipoPosto, Prezzo, Disponibilita } = req.body;

    if (TipoPosto !== undefined && Prezzo !== undefined && Disponibilita !== undefined) {
        const query = `
            UPDATE BigliettiF1
            SET TipoPosto = ?, Prezzo = ?, Disponibilita = ?
            WHERE BigliettoID = ?
        `;

        db.query(query, [TipoPosto, Prezzo, Disponibilita, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Biglietto non trovato' });
            res.json({ message: 'Biglietto modificato con successo' });
        });
    } else if (Prezzo !== undefined && Disponibilita !== undefined) {
        const query = `
            UPDATE BigliettiF1
            SET Prezzo = ?, Disponibilita = ?
            WHERE BigliettoID = ?
        `;

        db.query(query, [Prezzo, Disponibilita, id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Biglietto non trovato' });
            res.json({ message: 'Biglietto modificato con successo' });
        });
    } else {
        res.status(400).json({ error: 'Almeno Prezzo e Disponibilità sono obbligatori' });
    }
});

// Elimina biglietto
router.delete('/biglietti/:id', (req, res) => {
    const { id } = req.params;

    const query = 'DELETE FROM BigliettiF1 WHERE BigliettoID = ?';
    db.query(query, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Biglietto non trovato' });
        res.json({ message: 'Biglietto eliminato con successo' });
    });
});

module.exports = router;
