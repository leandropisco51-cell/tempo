const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const CHAT_ID = 8837987148;
const TOKEN = '8965512753:AAF3UZSDECTJ1jUX1r_DFquUiD0rzsHBVwc';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

console.log('Iniciando o Bot de Controle do Telegram...');
sendMessage('Bot de Controle Iniciado no Servidor! 🚀 Use /ajuda para ver os comandos.');

let lastUpdateId = 0;

// Requisições HTTPS nativas e estáveis para Windows
function makeRequest(url, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new URL(url);
            const options = {
                hostname: parsedUrl.hostname,
                port: 443,
                path: parsedUrl.pathname + parsedUrl.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        resolve({ ok: false, description: 'Erro ao processar JSON: ' + e.message });
                    }
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

async function sendMessage(text) {
    try {
        await makeRequest(`${BASE_URL}/sendMessage`, 'POST', { chat_id: CHAT_ID, text: text });
    } catch (err) {
        console.error('Erro ao enviar mensagem:', err.message);
    }
}

function runShellCommand(cmd) {
    return new Promise((resolve) => {
        exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
            if (error) {
                resolve(`Erro: ${error.message}\n${stderr}`);
                return;
            }
            resolve(stdout || stderr || 'Comando executado com sucesso (sem retorno).');
        });
    });
}

async function handleCommand(msg) {
    const text = msg.text ? msg.text.trim() : '';
    if (!text) return;

    if (msg.chat.id !== CHAT_ID) {
        console.warn(`Tentativa de acesso não autorizada de Chat ID: ${msg.chat.id}`);
        return;
    }

    const args = text.split(' ');
    const cmd = args[0].toLowerCase();

    if (cmd === '/start' || cmd === '/ajuda') {
        const ajudaMsg = `🤖 Comandos Disponíveis:
/status - Status atual do servidor e versão do App
/deploy - Puxa a versão mais recente do Git (git pull)
/versao <numero> - Atualiza a versão do app (ex: /versao 4.0.0) e faz push
/cmd <comando> - Executa um comando do sistema no servidor`;
        sendMessage(ajudaMsg);
    } 
    else if (cmd === '/status') {
        try {
            const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
            const match = indexHtml.match(/<span class="version">([^<]+)<\/span>/);
            const version = match ? match[1] : 'Não identificada';
            
            const gitStatus = await runShellCommand('git status -s');
            
            sendMessage(`🖥️ STATUS DO SERVIDOR:
• Versão do App: ${version}
• Git Status:
${gitStatus || 'Tudo limpo/sincronizado!'}`);
        } catch (e) {
            sendMessage(`Erro ao ler status: ${e.message}`);
        }
    } 
    else if (cmd === '/deploy') {
        sendMessage('Iniciando deploy (git pull)... 🔄');
        const output = await runShellCommand('git pull origin main');
        sendMessage(`📄 RETORNO DO DEPLOY:\n\n${output}`);
    } 
    else if (cmd === '/versao') {
        const novaVersao = args[1];
        if (!novaVersao) {
            sendMessage('Por favor, informe a nova versão. Ex: /versao 4.0.0');
            return;
        }
        
        sendMessage(`Atualizando versão do App para ${novaVersao}... ⚙️`);
        
        try {
            // 1. Atualizar index.html
            let indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
            
            // Achar versão antiga
            const versionMatch = indexHtml.match(/v\d+\.\d+\.\d+/);
            const versaoAntiga = versionMatch ? versionMatch[0] : 'desconhecida';
            
            indexHtml = indexHtml.replace(/v\d+\.\d+\.\d+/g, `v${novaVersao}`);
            fs.writeFileSync(path.join(__dirname, 'index.html'), indexHtml, 'utf8');
            
            // 2. Incrementar cache do service-worker
            let sw = fs.readFileSync(path.join(__dirname, 'service-worker.js'), 'utf8');
            const cacheMatch = sw.match(/geoweather-cache-v(\d+)/);
            if (cacheMatch) {
                const nextCacheNum = parseInt(cacheMatch[1], 10) + 1;
                sw = sw.replace(/geoweather-cache-v\d+/g, `geoweather-cache-v${nextCacheNum}`);
                fs.writeFileSync(path.join(__dirname, 'service-worker.js'), sw, 'utf8');
            }
            
            sendMessage(`Versão alterada com sucesso de ${versaoAntiga} para v${novaVersao}! Fazendo commit e push no Git... 🚀`);
            
            const gitOutput = await runShellCommand(`git add . && git commit -m "chore: bump version to v${novaVersao} via Telegram Bot" && git push origin main`);
            sendMessage(`✅ Deploy concluído!\n\n${gitOutput}`);
            
        } catch (err) {
            sendMessage(`Erro durante o bump de versão: ${err.message}`);
        }
    } 
    else if (cmd === '/cmd') {
        const shellCmd = args.slice(1).join(' ');
        if (!shellCmd) {
            sendMessage('Envie o comando após o /cmd. Ex: /cmd dir');
            return;
        }
        sendMessage(`Executando: "${shellCmd}"... ⏳`);
        const output = await runShellCommand(shellCmd);
        sendMessage(`🖥️ RETORNO DO COMANDO:\n\n${output}`);
    }
}

async function startPolling() {
    while (true) {
        try {
            const data = await makeRequest(`${BASE_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`);
            if (data.ok && data.result && data.result.length > 0) {
                for (const update of data.result) {
                    lastUpdateId = update.update_id;
                    if (update.message) {
                        await handleCommand(update.message);
                    }
                }
            }
        } catch (err) {
            console.error('Erro no polling do Telegram:', err.message);
            // Aguarda 5 segundos antes de tentar novamente para evitar loop infinito rápido
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startPolling();
