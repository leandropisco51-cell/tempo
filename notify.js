#!/usr/bin/env node

const https = require('https');
const dns = require('dns');

if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const CHAT_ID = '8837987148';
const TOKEN = '8965512753:AAF3UZSDECTJ1jUX1r_DFquUiD0rzsHBVwc';

const message = process.argv.slice(2).join(' ') || 'Processo finalizado com sucesso! ✅';

const data = JSON.stringify({
    chat_id: CHAT_ID,
    text: message
});

const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TOKEN}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(body);
            if (json.ok) {
                console.log('Notificação enviada ao Telegram com sucesso! 🚀');
            } else {
                console.error('Erro ao enviar notificação:', json.description);
            }
        } catch (e) {
            console.error('Erro ao decodificar resposta do Telegram:', e.message);
        }
    });
});

req.on('error', (err) => {
    console.error('Erro de conexão com o Telegram:', err.message);
});

req.write(data);
req.end();
