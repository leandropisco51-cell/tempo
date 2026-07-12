#!/usr/bin/env node

const CHAT_ID = '8837987148';
const TOKEN = '8965512753:AAF3UZSDECTJ1jUX1r_DFquUiD0rzsHBVwc';

const message = process.argv.slice(2).join(' ') || 'Processo finalizado com sucesso! ✅';

fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message
    })
})
.then(res => res.json())
.then(data => {
    if (data.ok) {
        console.log('Notificação enviada ao Telegram com sucesso! 🚀');
    } else {
        console.error('Erro ao enviar notificação:', data.description);
    }
})
.catch(err => {
    console.error('Erro de conexão com o Telegram:', err.message);
});
