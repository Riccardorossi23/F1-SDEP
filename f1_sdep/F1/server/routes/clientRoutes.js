// routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// Biglietti per circuito
router.get('/bigliettiF1/circuito/:CircuitoID', (req, res) => {
    const { CircuitoID } = req.params;

    const query = `
        SELECT b.*, c.Nome AS NomeCircuito, c.Nazione, c.Giorno
        FROM BigliettiF1 b
        JOIN Circuiti c ON b.GranPremioID = c.CircuitoID
        WHERE b.GranPremioID = ? AND c.Giorno = (
            SELECT MAX(Giorno) FROM Circuiti WHERE CircuitoID = ?
        )
        ORDER BY 
            CASE b.TipoPosto
                WHEN 'Paddock' THEN 1 
                WHEN 'Gradinate' THEN 2 
                WHEN 'Prato' THEN 3 
            END
    `;

    db.query(query, [CircuitoID, CircuitoID], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Acquisto biglietti - Versione migliorata
router.post('/acquista-bigliettiF1', (req, res) => {
    const { CartaIdentitàID, BigliettoID, Quantita, NumeroCarta } = req.body;

    if (!CartaIdentitàID || !BigliettoID || !Quantita || !NumeroCarta) {
        console.warn('⚠️  Campi mancanti nella richiesta');
        return res.status(400).json({ error: 'Tutti i campi sono obbligatori' });
    }

    if (NumeroCarta.length !== 9) {
        console.warn('⚠️  NumeroCarta non è di 9 cifre');
        return res.status(400).json({ error: 'Il numero di carta deve essere di 9 cifre' });
    }

    // Prima verifica: controlla se l'utente esiste e il suo numero carta
    const checkUserQuery = `SELECT NumeroCarta FROM Utenti WHERE CartaIdentitàID = ?`;

    db.query(checkUserQuery, [CartaIdentitàID], (err, userResults) => {
        if (err) {
            console.error('❌ Errore query SELECT Utenti:', err);
            return res.status(500).json({ error: err.message });
        }

        if (userResults.length === 0) {
            console.warn('⚠️  Utente non trovato con ID:', CartaIdentitàID);
            return res.status(404).json({ error: 'Utente non trovato' });
        }

        const utente = userResults[0];

        // Se l'utente ha già un numero carta, verifica che corrisponda
        if (utente.NumeroCarta) {
            if (utente.NumeroCarta !== NumeroCarta) {
                console.warn('⚠️  Numero carta non corrispondente. Atteso:', utente.NumeroCarta, 'Ricevuto:', NumeroCarta);
                return res.status(400).json({ 
                    error: 'Numero carta non corrispondente. Inserisci il numero carta corretto.',
                    cardMismatch: true 
                });
            }
        } else {
            // Se l'utente non ha ancora un numero carta, verifica che non sia già utilizzato da altri
            const checkCardQuery = `SELECT CartaIdentitàID FROM Utenti WHERE NumeroCarta = ? AND CartaIdentitàID != ?`;
            
            db.query(checkCardQuery, [NumeroCarta, CartaIdentitàID], (err, cardResults) => {
                if (err) {
                    console.error('❌ Errore verifica unicità numero carta:', err);
                    return res.status(500).json({ error: err.message });
                }

                if (cardResults.length > 0) {
                    console.warn('⚠️  Numero carta già in uso da altro utente');
                    return res.status(400).json({ 
                        error: 'Numero carta già utilizzato da un altro utente. Inserisci un numero carta diverso.',
                        cardInUse: true 
                    });
                }

                // Continua con l'acquisto e salva il numero carta
                proceedWithPurchase(CartaIdentitàID, BigliettoID, Quantita, NumeroCarta, true, res);
            });
            return; // Esce qui per evitare di continuare con l'esecuzione
        }

        // Se arriviamo qui, il numero carta è corretto, procediamo con l'acquisto
        proceedWithPurchase(CartaIdentitàID, BigliettoID, Quantita, NumeroCarta, false, res);
    });
});

// Funzione helper per gestire l'acquisto
function proceedWithPurchase(CartaIdentitàID, BigliettoID, Quantita, NumeroCarta, updateCard, res) {
    const checkQuery = `SELECT * FROM BigliettiF1 WHERE BigliettoID = ?`;

    db.query(checkQuery, [BigliettoID], (err, results) => {
        if (err) {
            console.error('❌ Errore query SELECT BigliettiF1:', err);
            return res.status(500).json({ error: err.message });
        }

        if (results.length === 0) {
            console.warn('⚠️  Biglietto non trovato con ID:', BigliettoID);
            return res.status(404).json({ error: 'Biglietto non trovato' });
        }

        const biglietto = results[0];

        if (biglietto.Disponibilita < Quantita) {
            console.warn('⚠️  Disponibilità insufficiente. Richiesta:', Quantita, 'Disponibili:', biglietto.Disponibilita);
            return res.status(400).json({ error: 'Biglietti non sufficienti disponibili' });
        }

        const totaleSpeso = biglietto.Prezzo * Quantita;

        db.beginTransaction((err) => {
            if (err) {
                console.error('❌ Errore inizializzazione transazione:', err);
                return res.status(500).json({ error: err.message });
            }

            const insertQuery = `
                INSERT INTO AcquistiBiglietti (CartaIdentitàID, BigliettoID, Quantita, NumeroCarta, TotaleSpeso)
                VALUES (?, ?, ?, ?, ?)
            `;

            db.query(insertQuery, [CartaIdentitàID, BigliettoID, Quantita, NumeroCarta, totaleSpeso], (err, result) => {
                if (err) {
                    console.error('❌ Errore inserimento acquisto:', err);
                    return db.rollback(() => {
                        res.status(500).json({ error: err.message });
                    });
                }

                const updateQuery = `
                    UPDATE BigliettiF1
                    SET Disponibilita = Disponibilita - ? 
                    WHERE BigliettoID = ?
                `;

                db.query(updateQuery, [Quantita, BigliettoID], (err) => {
                    if (err) {
                        console.error('❌ Errore aggiornamento disponibilità:', err);
                        return db.rollback(() => {
                            res.status(500).json({ error: err.message });
                        });
                    }

                    // Aggiorna il numero carta solo se è la prima volta
                    if (updateCard) {
                        const updateUserQuery = `
                            UPDATE Utenti 
                            SET NumeroCarta = ? 
                            WHERE CartaIdentitàID = ?
                        `;

                        db.query(updateUserQuery, [NumeroCarta, CartaIdentitàID], (err) => {
                            if (err) {
                                console.error('❌ Errore aggiornamento utente:', err);
                                return db.rollback(() => {
                                    res.status(500).json({ error: err.message });
                                });
                            }

                            commitTransaction(result, totaleSpeso, res);
                        });
                    } else {
                        // Non aggiorna il numero carta, procede direttamente al commit
                        commitTransaction(result, totaleSpeso, res);
                    }
                });
            });
        });
    });
}

// Funzione helper per il commit della transazione
function commitTransaction(result, totaleSpeso, res) {
    db.commit((err) => {
        if (err) {
            console.error('❌ Errore commit transazione:', err);
            return db.rollback(() => {
                res.status(500).json({ error: err.message });
            });
        }
        
        console.log('✅ Acquisto completato con successo. ID:', result.insertId);
        res.json({
            message: 'Acquisto completato con successo',
            acquistoId: result.insertId,
            totaleSpeso: totaleSpeso
        });
    });
}

// Classifiche, piloti, costruttori, circuiti, risultati
router.get('/ClassificaPiloti2025', (req, res) => {
    const query = `
        SELECT cp.*, p.Nome, p.Cognome, p.Nazionalita, c.Nome AS NomeCostruttore
        FROM ClassificaPiloti2025 cp
        JOIN Piloti p ON cp.PilotaID = p.PilotaID
        JOIN Costruttori c ON cp.CostruttoreID = c.CostruttoreID
        ORDER BY cp.Posizione ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get('/ClassificaCostruttori2025', (req, res) => {
    const query = `
        SELECT c2025.*, c.Nome AS NomeCostruttore, c.Nazionalita
        FROM ClassificaCostruttori2025 c2025
        JOIN Costruttori c ON c2025.CostruttoreID = c.CostruttoreID
        ORDER BY c2025.Posizione ASC
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get('/Piloti', (req, res) => {
    db.query('SELECT * FROM Piloti ORDER BY Cognome, Nome', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get('/Costruttori', (req, res) => {
    db.query('SELECT * FROM Costruttori ORDER BY Nome', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get('/Circuiti', (req, res) => {
    const query = `
        SELECT DISTINCT c.CircuitoID, c.Nome, c.Nazione, c.Giorno
        FROM Circuiti c
        WHERE (c.CircuitoID, c.Giorno) IN (
            SELECT CircuitoID, MAX(Giorno)
            FROM Circuiti
            GROUP BY CircuitoID
        )
        ORDER BY c.CircuitoID
    `;
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

router.get('/RisultatiGare', (req, res) => {
    const circuitoFiltro = req.query.circuito;
    let query;
    let params = [];

    if (circuitoFiltro) {
        query = `
            SELECT rg.*, p.Nome AS NomePilota, p.Cognome, p.Nazionalita AS NazionalitaPilota,
                   c.Nome AS Team, cir.Nome AS NomeCircuito, cir.Nazione, cir.Giorno AS Data
            FROM RisultatiGare rg
            JOIN Piloti p ON rg.PilotaID = p.PilotaID
            JOIN Costruttori c ON rg.CostruttoreID = c.CostruttoreID
            JOIN (
                SELECT * FROM Circuiti
                WHERE (CircuitoID, Giorno) IN (
                    SELECT CircuitoID, MAX(Giorno) FROM Circuiti GROUP BY CircuitoID
                )
            ) AS cir ON rg.CircuitoID = cir.CircuitoID
            WHERE rg.CircuitoID = ?
            ORDER BY 
                CASE WHEN rg.PosizioneFinale IS NULL THEN 1 ELSE 0 END,
                rg.PosizioneFinale ASC
        `;
        params = [circuitoFiltro];
    } else {
        query = `
            SELECT rg.*, p.Nome AS NomePilota, p.Cognome, p.Nazionalita AS NazionalitaPilota,
                   c.Nome AS Team, cir.Nome AS NomeCircuito, cir.Nazione, cir.Giorno AS Data
            FROM RisultatiGare rg
            JOIN Piloti p ON rg.PilotaID = p.PilotaID
            JOIN Costruttori c ON rg.CostruttoreID = c.CostruttoreID
            JOIN (
                SELECT * FROM Circuiti
                WHERE (CircuitoID, Giorno) IN (
                    SELECT CircuitoID, MAX(Giorno) FROM Circuiti GROUP BY CircuitoID
                )
            ) AS cir ON rg.CircuitoID = cir.CircuitoID
            WHERE rg.PosizioneFinale = 1
            ORDER BY cir.Giorno ASC
        `;
    }

    db.query(query, params, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

module.exports = router;
