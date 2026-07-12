const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const dns = require('dns');

// Força o Node.js a priorizar IPv4 sobre IPv6 (resolve bugs de ECONNRESET no Windows)
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

const CHAT_ID = 8837987148;
const TOKEN = '8965512753:AAF3UZSDECTJ1jUX1r_DFquUiD0rzsHBVwc';
const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;

// Carregar chaves de configuração local
let config = { GEMINI_API_KEY: "" };
try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
} catch (e) {
    console.warn('Erro ao carregar config.json:', e.message);
}

console.log('Iniciando o Bot de Controle do Telegram...');
sendMessage('Bot de Controle Iniciado no Servidor! 🚀 Use /ajuda para ver os comandos ou envie uma mensagem normal para conversar comigo.');

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

// Comunicação com a API oficial do Gemini 1.5 Flash
async function askGemini(question) {
    const key = config.GEMINI_API_KEY;
    if (!key || key === 'SUA_API_KEY_AQUI') {
        return 'Chave de API do Gemini não configurada. Para podermos conversar, crie uma chave gratuita em https://aistudio.google.com/ e configure-a no arquivo config.json do seu projeto!';
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
    const payload = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `Você é o assistente virtual IA do aplicativo Abutres GPS (desenvolvido por Leandro Pisco). Responda de forma prestativa, direta e curta. Diga que é a IA dele. Pergunta do usuário: ${question}`
                    }
                ]
            }
        ]
    };

    try {
        const res = await makeRequest(url, 'POST', payload);
        if (res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts[0]) {
            return res.candidates[0].content.parts[0].text;
        }
        return 'Desculpe, não consegui processar a resposta da IA.';
    } catch (err) {
        return `Erro ao falar com a IA: ${err.message}`;
    }
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

    if (cmd.startsWith('/')) {
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
    } else {
        // Conversa direta com o Gemini
        sendMessage('Deixe-me pensar... 🤔');
        const reply = await askGemini(text);
        sendMessage(reply);
    }
}

async function startPolling() {
    while (true) {
        try {
            // Usamos timeout=0 para fechar a conexão de imediato e evitar ECONNRESET em conexões restritas
            const data = await makeRequest(`${BASE_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`);
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
        }
        // Espera 2 segundos antes de verificar novamente
        await new Promise(r => setTimeout(r, 2000));
    }
}

startPolling();
