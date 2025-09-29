// db.js
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Inter2307!',
    database: 'f1'
});

db.connect(err => {
    if (err) throw err;
    console.log('✅ Connesso al database f1');
});

module.exports = db;
