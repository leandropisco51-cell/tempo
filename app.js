// Registrar Service Worker para PWA (Instalável e Offline)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('Service Worker registrado com sucesso:', reg.scope))
            .catch(err => console.error('Erro ao registrar Service Worker:', err));
    });
}

// Inicializar ícones do Lucide
lucide.createIcons();

// Elementos do DOM
const timeEl = document.getElementById('current-time');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchFeedback = document.getElementById('search-feedback');

const currentTemp = document.getElementById('current-temp');
const currentDesc = document.getElementById('current-desc');
const locationName = document.getElementById('location-name');
const currentHumidity = document.getElementById('current-humidity');
const currentWind = document.getElementById('current-wind');
const forecastScroll = document.getElementById('forecast-scroll');

const routeStartInput = document.getElementById('route-start');
const routeEndInput = document.getElementById('route-end');
const myLocationBtn = document.getElementById('my-location-btn');
const routeBtn = document.getElementById('route-btn');
const clearRouteBtn = document.getElementById('clear-route-btn');
const routeInstructions = document.getElementById('route-instructions');

// Novos Elementos para GPS & Trânsito
const startNavBtn = document.getElementById('start-nav-btn');
const gpsNavHud = document.getElementById('gps-nav-hud');
const stopNavBtn = document.getElementById('stop-nav-btn');
const navNextStep = document.getElementById('nav-next-step');
const navNextDist = document.getElementById('nav-next-dist');
const navArrival = document.getElementById('nav-arrival');
const navEta = document.getElementById('nav-eta');
const navTraffic = document.getElementById('nav-traffic');

const speedometerNavHud = document.getElementById('speedometer-nav-hud');
const bigSpeedValue = document.getElementById('big-speed-value');

const viewRouteDetailsBtn = document.getElementById('view-route-details-btn');
const routeSummaryCard = document.getElementById('route-summary-card');
const routeOptionsModal = document.getElementById('route-options-modal');
const routeOptionsList = document.getElementById('route-options-list');
const routeDetailsModal = document.getElementById('route-details-modal');
const routeDetailsList = document.getElementById('route-details-list');

const hudLat = document.getElementById('hud-lat');
const hudLng = document.getElementById('hud-lng');
const themeToggleBtn = document.getElementById('theme-toggle-btn');

// Variáveis de Estado
let map;
let markerStart = null;
let markerEnd = null;
let routingControl = null;

let startCoords = null; // {lat, lng}
let endCoords = null; // {lat, lng}

let isDarkMode = false;
let darkTileLayer;
let lightTileLayer;

let isNavigating = false;
let navigationWatchId = null;
let lastRecalculateTime = 0;
let lastLat = null;
let lastLng = null;
let currentHeading = 0;
let simulationIntervalId = null;
let currentRouteData = null;
let availableRoutes = [];
let selectedRouteIndex = 0;
let trafficPolylines = [];

// Tabela de Códigos do Tempo WMO (Open-Meteo) para Português e Ícones Lucide
const weatherCodes = {
    0: { desc: 'Céu limpo', icon: 'sun' },
    1: { desc: 'Principalmente limpo', icon: 'cloud-sun' },
    2: { desc: 'Parcialmente nublado', icon: 'cloud' },
    3: { desc: 'Encoberto', icon: 'cloudy' },
    45: { desc: 'Nevoeiro', icon: 'cloud-fog' },
    48: { desc: 'Nevoeiro com geada', icon: 'cloud-fog' },
    51: { desc: 'Chuvisco leve', icon: 'cloud-drizzle' },
    53: { desc: 'Chuvisco moderado', icon: 'cloud-drizzle' },
    55: { desc: 'Chuvisco denso', icon: 'cloud-drizzle' },
    61: { desc: 'Chuva fraca', icon: 'cloud-rain' },
    63: { desc: 'Chuva moderada', icon: 'cloud-rain' },
    65: { desc: 'Chuva forte', icon: 'cloud-rain' },
    71: { desc: 'Neve leve', icon: 'snowflake' },
    73: { desc: 'Neve moderada', icon: 'snowflake' },
    75: { desc: 'Neve forte', icon: 'snowflake' },
    77: { desc: 'Grãos de neve', icon: 'snowflake' },
    80: { desc: 'Pancadas de chuva leve', icon: 'cloud-hail' },
    81: { desc: 'Pancadas de chuva moderadas', icon: 'cloud-hail' },
    82: { desc: 'Pancadas de chuva violentas', icon: 'cloud-hail' },
    85: { desc: 'Pancadas de neve leves', icon: 'snowflake' },
    86: { desc: 'Pancadas de neve fortes', icon: 'snowflake' },
    95: { desc: 'Trovoada fraca ou moderada', icon: 'cloud-lightning' },
    96: { desc: 'Trovoada com granizo leve', icon: 'cloud-lightning' },
    99: { desc: 'Trovoada com granizo forte', icon: 'cloud-lightning' }
};

// 1. Relógio do Sistema (HUD Superior)
function updateClock() {
    const now = new Date();
    const options = { 
        timeZone: 'America/Sao_Paulo', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    timeEl.innerText = `SYS_TIME // ${now.toLocaleString('pt-BR', options).replace(',', ' -')}`;
}
setInterval(updateClock, 1000);
updateClock();

// 2. Inicialização do Mapa Leaflet
function initMap() {
    // Coordenadas padrão (Rio de Janeiro / Brasil)
    const defaultLat = -22.9068;
    const defaultLng = -43.1729;
    
    map = L.map('map', {
        zoomControl: true,
        attributionControl: false
    }).setView([defaultLat, defaultLng], 12);

    // Define camadas de mapa para Modo Noturno e Claro
    darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    });

    lightTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    });

    // Adiciona camada padrão (Clara)
    lightTileLayer.addTo(map);

    // Listener de movimento do mouse para atualizar o HUD de coordenadas
    map.on('mousemove', function(e) {
        hudLat.innerText = e.latlng.lat.toFixed(6);
        hudLng.innerText = e.latlng.lng.toFixed(6);
    });

    // Clique no mapa define o destino de rota ou ponto de busca
    map.on('click', function(e) {
        const popupContent = `
            <div style="font-family: 'Outfit', sans-serif; padding: 5px; min-width: 140px;">
                <strong style="display:block; margin-bottom: 8px; color: #00f0ff; font-size: 13px; text-align: center;">DEFINIR COORDENADAS</strong>
                <button onclick="window.setStartFromMap(${e.latlng.lat}, ${e.latlng.lng})" style="display:block; width:100%; font-family:'Outfit',sans-serif; font-size:11px; padding:6px; margin-bottom:6px; border:1px solid #00f0ff; border-radius:4px; cursor:pointer; background:rgba(0,240,255,0.1); color:#fff; font-weight:600;">PARTIDA</button>
                <button onclick="window.setDestinationFromMap(${e.latlng.lat}, ${e.latlng.lng})" style="display:block; width:100%; font-family:'Outfit',sans-serif; font-size:11px; padding:6px; border:none; border-radius:4px; cursor:pointer; background:#00f0ff; color:#000; font-weight:600;">DESTINO</button>
            </div>
        `;
        L.popup()
            .setLatLng(e.latlng)
            .setContent(popupContent)
            .openOn(map);
    });

    // Plota as sedes cadastradas no mapa
    plotAllSedes();

    // Inicia geolocalização do usuário para ponto de partida
    getUserLocation();
}


let sedeMarkers = [];

function plotAllSedes() {
    // Limpa marcadores anteriores se houver
    sedeMarkers.forEach(marker => map.removeLayer(marker));
    sedeMarkers = [];
    
    const sedes = window.SEDES_DATABASE || {};
    for (const key in sedes) {
        const sede = sedes[key];
        
        // Marcador customizado para sede
        const customSedeIcon = L.divIcon({
            className: 'custom-gps-marker sede-marker-pin',
            html: `<div class="marker-pulse-sede"></div>`,
            iconSize: [22, 22]
        });
        
        const marker = L.marker([sede.lat, sede.lng], { icon: customSedeIcon })
            .addTo(map)
            .bindPopup(`
                <div style="font-family: 'Outfit', sans-serif; padding: 5px;">
                    <strong style="color: #ff007f;">${sede.nome}</strong><br>
                    <small style="color: #7f8c8d; display:block; margin-bottom:8px;">${sede.endereco}</small>
                    <button onclick="window.setDestinationFromMap(${sede.lat}, ${sede.lng}, '${sede.nome}')" style="display:block; width:100%; font-family:'Outfit',sans-serif; font-size:11px; padding:6px; border:none; border-radius:4px; cursor:pointer; background:#00f0ff; color:#000; font-weight:600;">DEFINIR DESTINO</button>
                </div>
            `);
        
        sedeMarkers.push(marker);
    }
}

window.setStartFromMap = function(lat, lng) {
    startCoords = { lat, lng };
    routeStartInput.value = "Ponto no Mapa...";
    reverseGeocodeAddress(lat, lng);
    
    if (markerStart) {
        markerStart.setLatLng([lat, lng]);
    } else {
        const customStartIcon = L.divIcon({
            className: 'custom-gps-marker start',
            html: `<div class="marker-pulse start-pulse"></div>`,
            iconSize: [20, 20]
        });
        markerStart = L.marker([lat, lng], { icon: customStartIcon }).addTo(map);
    }
    
    checkRouteState();
    map.closePopup();
};

window.setDestinationFromMap = function(lat, lng, name) {
    const label = name || `Ponto no Mapa (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    setDestination(lat, lng, label);
    map.closePopup();
};

// Função para calcular o rumo (bearing/heading) entre duas coordenadas
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
              
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

// 3. Geolocalização do Usuário (GPS Partida)
function getUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                startCoords = { lat, lng };
                routeStartInput.value = "Obtendo endereço de partida...";
                
                // Executa geocodificação reversa para mostrar a rua/bairro real no campo de partida
                reverseGeocodeAddress(lat, lng);
                
                // Adiciona ou move marcador de partida
                if (markerStart) {
                    markerStart.setLatLng([lat, lng]);
                } else {
                    const customStartIcon = L.divIcon({
                        className: 'custom-gps-marker start',
                        html: `<div class="marker-pulse start-pulse"></div>`,
                        iconSize: [20, 20]
                    });
                    markerStart = L.marker([lat, lng], { icon: customStartIcon }).addTo(map);
                }
                
                // Foca o mapa na posição do usuário inicialmente
                map.setView([lat, lng], 13);
                
                // Se já houver fim, habilita rota
                checkRouteState();
                
                // Carrega o clima do ponto de partida de início
                fetchWeather(lat, lng, "Sua Posição Atual");
            },
            (error) => {
                console.warn('Erro ao obter localização:', error.message);
                showFeedback('Permissão de geolocalização negada. Digite uma partida manualmente se desejar rotas.', 'error');
            }
        );
    } else {
        showFeedback('Geolocalização não suportada no seu navegador.', 'error');
    }
}

// Auxiliar de Geocodificação Reversa (Lat/Lng -> Texto do Endereço)
async function reverseGeocodeAddress(lat, lng) {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'GPS-Abutres-App/3.0 (https://github.com/leandropisco51-cell/tempo)'
            }
        });
        const data = await response.json();
        if (data && data.display_name) {
            const parts = data.display_name.split(',');
            // Simplifica mostrando os 3 primeiros componentes do endereço (ex: Rua, Bairro, Cidade)
            const cleanName = parts.slice(0, 3).join(',').trim();
            routeStartInput.value = cleanName;
        } else {
            routeStartInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        }
    } catch (e) {
        console.warn('Erro no Nominatim reverso:', e);
        routeStartInput.value = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

// 4. Buscar e Resolver Endereços (CEP ou Texto)
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showFeedback('Por favor, insira um local ou CEP.', 'error');
        return;
    }

    showFeedback('Processando busca climática e mapeamento...', 'loading');

    // 1. Verificar se a busca é por uma Sede registrada (RAG Local)
    const normalizedQuery = query.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/[^a-z0-9 ]/g, ""); // remove caracteres especiais
    
    let matchedSede = null;
    const sedes = window.SEDES_DATABASE || {};
    
    for (const key in sedes) {
        const nameNormalized = sedes[key].nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Verifica se a busca contém a palavra-chave (ex: "mage") ou o nome completo da sede
        if (normalizedQuery.includes(key) || nameNormalized.includes(normalizedQuery)) {
            matchedSede = sedes[key];
            break;
        }
    }

    if (matchedSede) {
        // Encontrou a sede localmente: define coordenadas instantaneamente sem precisar de geolocalizar externo
        setDestination(matchedSede.lat, matchedSede.lng, matchedSede.nome);
        showFeedback(`Sucesso! Localizada a ${matchedSede.nome}`, 'success');
        return;
    }

    // Valida se a busca se parece com um CEP (Brasil)
    const cepRegex = /^\d{5}-?\d{3}$/;
    if (cepRegex.test(query)) {
        const cleanCep = query.replace('-', '');
        try {
            const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
            const viaCepData = await viaCepResponse.json();
            
            if (viaCepData.erro) {
                throw new Error('CEP não encontrado.');
            }

            const fullAddress = `${viaCepData.logradouro || ''} ${viaCepData.bairro || ''} ${viaCepData.localidade} ${viaCepData.uf}`;
            const searchName = `${viaCepData.bairro || viaCepData.localidade}, ${viaCepData.localidade} - ${viaCepData.uf}`;
            
            // Agora busca as coordenadas na API Nominatim
            const coords = await geocodeAddress(fullAddress);
            if (coords) {
                setDestination(coords.lat, coords.lng, searchName);
                showFeedback(`Sucesso! Localizado: ${searchName}`, 'success');
            } else {
                throw new Error('Não foi possível obter coordenadas para o CEP informado.');
            }
        } catch (err) {
            showFeedback(`Erro ao buscar CEP: ${err.message}`, 'error');
        }
    } else {
        // Busca geral por texto (Cidade, Bairro, etc)
        try {
            const coords = await geocodeAddress(query);
            if (coords) {
                setDestination(coords.lat, coords.lng, coords.name);
                showFeedback(`Sucesso! Localizado: ${coords.name}`, 'success');
            } else {
                throw new Error('Local não encontrado.');
            }
        } catch (err) {
            showFeedback(`Erro na busca: ${err.message}`, 'error');
        }
    }
}

// Auxiliar de Geocodificação Nominatim
async function geocodeAddress(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'GPS-Abutres-App/3.0 (https://github.com/leandropisco51-cell/tempo)'
        }
    });
    const data = await response.json();
    if (data && data.length > 0) {
        return {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            name: data[0].display_name.split(',').slice(0, 3).join(',') // Simplifica o nome
        };
    }
    return null;
}

// 5. Configurar Destino e Chamar Clima
function setDestination(lat, lng, name) {
    endCoords = { lat, lng };
    routeEndInput.value = name;
    
    // Adicionar ou mover marcador de destino no mapa
    if (markerEnd) {
        markerEnd.setLatLng([lat, lng]);
    } else {
        const customEndIcon = L.divIcon({
            className: 'custom-gps-marker end',
            html: `<div class="marker-pulse end-pulse"></div>`,
            iconSize: [20, 20]
        });
        markerEnd = L.marker([lat, lng], { icon: customEndIcon }).addTo(map);
    }
    
    map.setView([lat, lng], 14);
    
    // Atualizar UI de rotas
    checkRouteState();
    
    // Traça a rota automaticamente se já tivermos um ponto de partida
    if (startCoords) {
        drawRoute();
    }
    
    // Buscar telemetria climática
    fetchWeather(lat, lng, name);
}

// 6. Buscar Telemetria Climática (Open-Meteo)
async function fetchWeather(lat, lng, label) {
    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto&forecast_days=2`;
        const res = await fetch(weatherUrl);
        const data = await res.json();
        
        if (!data || !data.hourly) {
            throw new Error('Formato de dados climáticos inválido.');
        }

        // Achar a hora atual correspondente de forma robusta (índice mais próximo de agora)
        const nowMs = Date.now();
        let startIndex = -1;
        let minDiff = Infinity;
        
        data.hourly.time.forEach((t, idx) => {
            const diff = Math.abs(new Date(t).getTime() - nowMs);
            if (diff < minDiff) {
                minDiff = diff;
                startIndex = idx;
            }
        });
        
        if (startIndex === -1) startIndex = 0;

        // Extrair dados atuais
        const tempNow = data.hourly.temperature_2m[startIndex];
        const humNow = data.hourly.relative_humidity_2m[startIndex];
        const codeNow = data.hourly.weather_code[startIndex];
        const windNow = data.hourly.wind_speed_10m[startIndex];
        
        const currentMeta = weatherCodes[codeNow] || { desc: 'Desconhecido', icon: 'cloud' };

        // Atualizar UI Clima Atual
        currentTemp.innerText = `${Math.round(tempNow)}°C`;
        currentDesc.innerHTML = `<i data-lucide="${currentMeta.icon}" class="weather-icon-main"></i> ${currentMeta.desc}`;
        locationName.innerText = label;
        currentHumidity.innerText = `${humNow}%`;
        currentWind.innerText = `${Math.round(windNow)} km/h`;

        // Gerar previsão para as próximas 24 horas
        forecastScroll.innerHTML = '';
        
        for (let i = 0; i < 24; i++) {
            const index = startIndex + i;
            if (index >= data.hourly.time.length) break;

            const timeStr = data.hourly.time[index];
            const timeObj = new Date(timeStr);
            const formattedHour = timeObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const tempVal = Math.round(data.hourly.temperature_2m[index]);
            const codeVal = data.hourly.weather_code[index];
            const metaVal = weatherCodes[codeVal] || { desc: 'Clima', icon: 'cloud' };

            const card = document.createElement('div');
            card.className = 'forecast-card';
            card.innerHTML = `
                <span class="hour">${formattedHour}</span>
                <i data-lucide="${metaVal.icon}" title="${metaVal.desc}"></i>
                <span class="temp">${tempVal}°C</span>
            `;
            forecastScroll.appendChild(card);
        }

        // Recria os ícones inseridos dinamicamente
        lucide.createIcons();

    } catch (err) {
        console.error(err);
        showFeedback('Erro ao atualizar dados meteorológicos.', 'error');
    }
}

// 7. Habilita/Desabilita botão de Rota
function checkRouteState() {
    if (startCoords && endCoords) {
        routeBtn.disabled = false;
    } else {
        routeBtn.disabled = true;
    }
}

// 8. Traçar Rota GPS (Leaflet Routing Machine + OSRM)
function drawRoute() {
    if (!startCoords || !endCoords) return;

    // Se já existe uma rota no mapa, remove
    if (routingControl) {
        map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(startCoords.lat, startCoords.lng),
            L.latLng(endCoords.lat, endCoords.lng)
        ],
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            language: 'pt-BR',
            routingOptions: {
                alternatives: true
            }
        }),
        lineOptions: {
            styles: [
                { color: '#00f0ff', opacity: 0.8, weight: 6 },
                { color: '#a100ff', opacity: 0.4, weight: 10 } // Neon Glow extra
            ]
        },
        createMarker: function(i, waypoint, n) {
            // Retorna vazio para não duplicar marcadores
            return null;
        },
        show: false,
        addWaypoints: false,
        draggableWaypoints: false
    }).addTo(map);

    // Capturar instruções de rota
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        availableRoutes = routes;
        selectedRouteIndex = 0;
        currentRouteData = routes[0];
        
        // Habilita botões de controle
        startNavBtn.classList.remove('hidden');
        clearRouteBtn.classList.remove('hidden');
        viewRouteDetailsBtn.classList.remove('hidden');
        
        showFeedback('Rotas carregadas com sucesso.', 'success');
        
        // Abre o popup de seleção de rotas para o usuário escolher
        showRouteOptionsModal(routes);
        
        // Calcular e desenhar o Trânsito da rota recomendada inicial
        drawTrafficOverlay(currentRouteData);

        // Ajusta o zoom do mapa para englobar toda a rota apenas se não estiver navegando ativamente
        if (!isNavigating) {
            const bounds = L.latLngBounds([
                [startCoords.lat, startCoords.lng],
                [endCoords.lat, endCoords.lng]
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    });

    routingControl.on('routingerror', function(err) {
        console.error(err);
        showFeedback('Erro ao traçar rota. Tente novamente.', 'error');
    });
}

// 9. Limpar Rota
function clearRoute() {
    stopNavigation();
    clearTrafficPolylines();
    
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    if (markerEnd) {
        map.removeLayer(markerEnd);
        markerEnd = null;
    }
    
    endCoords = null;
    routeEndInput.value = '';
    viewRouteDetailsBtn.classList.add('hidden');
    routeSummaryCard.classList.add('hidden');
    routeOptionsModal.classList.add('hidden');
    routeDetailsModal.classList.add('hidden');
    clearRouteBtn.classList.add('hidden');
    startNavBtn.classList.add('hidden');
    routeBtn.disabled = true;
}

// 10. Feedbacks visuais rápidos
function showFeedback(msg, type) {
    searchFeedback.innerText = msg;
    searchFeedback.className = `search-feedback ${type}`;
    searchFeedback.classList.remove('hidden');
    
    // Auto-oculta após 5 segundos se for sucesso ou erro simples
    if (type !== 'loading') {
        setTimeout(() => {
            searchFeedback.classList.add('hidden');
        }, 5000);
    }
}

// Listeners de Eventos
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

myLocationBtn.addEventListener('click', () => {
    showFeedback('Sincronizando coordenadas de GPS atual...', 'loading');
    getUserLocation();
});

routeBtn.addEventListener('click', drawRoute);
clearRouteBtn.addEventListener('click', clearRoute);

function toggleTheme() {
    isDarkMode = !isDarkMode;
    if (isDarkMode) {
        document.body.classList.remove('light-theme');
        map.removeLayer(lightTileLayer);
        darkTileLayer.addTo(map);
        themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
    } else {
        document.body.classList.add('light-theme');
        map.removeLayer(darkTileLayer);
        lightTileLayer.addTo(map);
        themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
    }
    lucide.createIcons();
}

themeToggleBtn.addEventListener('click', toggleTheme);

// ==========================================================================
// FUNÇÕES DE TRÂNSITO & GPS EM TEMPO REAL
// ==========================================================================
function drawTrafficOverlay(route) {
    clearTrafficPolylines();
    
    const coords = route.coordinates;
    const segmentsCount = 3;
    const segmentLength = Math.floor(coords.length / segmentsCount);

    const trafficLevels = [
        { label: 'LIVRE', color: '#2ecc71', delay: 0 },
        { label: 'MODERADO', color: '#f1c40f', delay: 2 },
        { label: 'INTENSO', color: '#e74c3c', delay: 7 }
    ];

    const randomTraffic = trafficLevels[Math.floor(Math.random() * trafficLevels.length)];
    
    navTraffic.innerText = randomTraffic.label;
    navTraffic.className = `traffic-tag ${randomTraffic.label === 'LIVRE' ? 'green' : randomTraffic.label === 'MODERADO' ? 'yellow' : 'red'}`;

    for (let i = 0; i < segmentsCount; i++) {
        const startIdx = i * segmentLength;
        const endIdx = i === segmentsCount - 1 ? coords.length : (i + 1) * segmentLength;
        const segmentCoords = coords.slice(startIdx, endIdx);
        
        const localTraffic = trafficLevels[Math.floor(Math.random() * trafficLevels.length)];

        const poly = L.polyline(segmentCoords, {
            color: localTraffic.color,
            weight: 8,
            opacity: 0.85,
            dashArray: localTraffic.label === 'INTENSO' ? '1, 10' : null
        }).addTo(map);

        trafficPolylines.push(poly);
    }

    const originalTimeMins = Math.round(route.summary.totalTime / 60);
    const trafficDelay = randomTraffic.delay;
    const finalEta = originalTimeMins + trafficDelay;

    navEta.innerText = `${finalEta} min`;

    // Calcula a hora de chegada
    const arrivalDate = new Date();
    arrivalDate.setMinutes(arrivalDate.getMinutes() + finalEta);
    const arrHours = String(arrivalDate.getHours()).padStart(2, '0');
    const arrMins = String(arrivalDate.getMinutes()).padStart(2, '0');
    navArrival.innerText = `${arrHours}:${arrMins}`;
    
    const distanceKms = (route.summary.totalDistance / 1000).toFixed(1);
    routeSummaryCard.innerHTML = `
        <i data-lucide="info"></i> ROTA GERADA: ${distanceKms} km (~${finalEta} min) <br>
        <span style="font-size:0.75rem; color:${randomTraffic.color}">Trânsito: ${randomTraffic.label} (+${trafficDelay}m)</span>
    `;
    routeSummaryCard.classList.remove('hidden');
    lucide.createIcons();
}

function clearTrafficPolylines() {
    trafficPolylines.forEach(poly => map.removeLayer(poly));
    trafficPolylines = [];
}

function startNavigation() {
    if (!currentRouteData) return;
    
    isNavigating = true;
    gpsNavHud.classList.remove('hidden');
    speedometerNavHud.classList.remove('hidden');
    startNavBtn.classList.add('hidden');
    clearRouteBtn.classList.add('hidden');
    routeBtn.disabled = true;

    // Ativa classe de navegação no body (CSS esconde header/sidebar e expande mapa)
    document.body.classList.add('navigation-active');
    setTimeout(() => { map.invalidateSize(); }, 300);

    const coords = currentRouteData.coordinates;
    const instructions = currentRouteData.instructions;

    // Configura o marcador com ícone de seta/bússola para navegação
    const navArrowIcon = L.divIcon({
        className: 'custom-gps-marker start',
        html: `<div class="marker-arrow-wrapper"><div class="start-arrow" style="transform: rotate(${currentHeading}deg);"></div></div>`,
        iconSize: [24, 24]
    });
    
    if (markerStart) {
        markerStart.setIcon(navArrowIcon);
        markerStart.setLatLng([coords[0].lat, coords[0].lng]);
    } else {
        markerStart = L.marker([coords[0].lat, coords[0].lng], { icon: navArrowIcon }).addTo(map);
    }

    // NAVEGAÇÃO REAL COM GPS DO APARELHO
    showFeedback('GPS Real ativado. Siga a rota...', 'success');
    bigSpeedValue.innerText = `0`;
    
    if ('geolocation' in navigator) {
        navigationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const currentPos = { lat, lng };
                
                // Calcula a direção/heading (bússola) com base no movimento ou GPS nativo
                if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                    currentHeading = position.coords.heading;
                } else if (lastLat !== null && lastLng !== null) {
                    const distanceMoved = map.distance([lastLat, lastLng], [lat, lng]);
                    // Apenas atualiza o rumo se houver deslocamento real maior que 2 metros
                    if (distanceMoved > 2) {
                        currentHeading = calculateBearing(lastLat, lastLng, lat, lng);
                    }
                }
                
                lastLat = lat;
                lastLng = lng;

                // Move o marcador para a posição real
                markerStart.setLatLng([lat, lng]);
                map.setView([lat, lng], 17);

                // Rotaciona a seta do marcador de partida para que ela aponte para a direção correta do movimento
                const arrowEl = document.querySelector('.start-arrow');
                if (arrowEl) {
                    arrowEl.style.transform = `rotate(${currentHeading}deg)`;
                }

                // Rotaciona o container do mapa para que a direção de viagem aponte sempre para a frente (estilo Waze)
                const mapDiv = document.getElementById('map');
                if (mapDiv) {
                    mapDiv.style.transform = `rotate(${-currentHeading}deg) scale(1.3)`;
                    mapDiv.style.transition = 'transform 0.4s ease-out';
                }
                
                // Velocidade real em km/h
                const speed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;
                bigSpeedValue.innerText = speed;

                // Acha a coordenada da rota mais próxima dinamicamente do objeto global
                if (!currentRouteData) return;
                const activeCoords = currentRouteData.coordinates;
                const activeInstructions = currentRouteData.instructions;

                let closestIdx = 0;
                let minDist = Infinity;
                activeCoords.forEach((coord, idx) => {
                    const d = map.distance([lat, lng], [coord.lat, coord.lng]);
                    if (d < minDist) {
                        minDist = d;
                        closestIdx = idx;
                    }
                });

                // Verifica se o usuário saiu da rota (distância maior que 50 metros)
                // com um intervalo mínimo de 12 segundos entre recálculos para evitar sobrecarga de chamadas API
                const nowMs = Date.now();
                if (minDist > 50 && (nowMs - lastRecalculateTime > 12000)) {
                    lastRecalculateTime = nowMs;
                    showFeedback('Desvio detectado! Recalculando rota...', 'loading');
                    
                    // Atualiza as coordenadas de partida para a posição atual
                    startCoords = { lat, lng };
                    
                    // Atualiza os waypoints do Leaflet Routing Control (isso atualiza a rota e chama 'routesfound' automaticamente)
                    if (routingControl) {
                        routingControl.setWaypoints([
                            L.latLng(lat, lng),
                            L.latLng(endCoords.lat, endCoords.lng)
                        ]);
                    }
                }

                // Atualiza instruções
                updateHUDInstructions(currentPos, activeCoords, activeInstructions, closestIdx);
            },
            (err) => {
                console.warn(err);
                showFeedback('Erro ao acessar GPS. Certifique-se de que a localização está ativa.', 'error');
            },
            { enableHighAccuracy: true }
        );
    } else {
        showFeedback('Suporte a GPS não disponível neste dispositivo.', 'error');
    }
}

// Função auxiliar para atualizar a instrução de direção no HUD
function updateHUDInstructions(currentPos, coords, instructions, currentIdx) {
    let activeInstruction = null;
    let minDist = Infinity;
    
    instructions.forEach(inst => {
        const instCoord = coords[inst.index];
        if (instCoord && inst.index > currentIdx) {
            const d = map.distance([currentPos.lat, currentPos.lng], [instCoord.lat, instCoord.lng]);
            if (d < minDist) {
                minDist = d;
                activeInstruction = inst;
            }
        }
    });

    if (activeInstruction) {
        navNextStep.innerText = activeInstruction.text;
        navNextDist.innerText = `a ${Math.round(minDist)} metros`;
    } else {
        navNextStep.innerText = "Siga na rota";
        navNextDist.innerText = "até o destino";
    }
}

function stopNavigation() {
    isNavigating = false;
    gpsNavHud.classList.add('hidden');
    speedometerNavHud.classList.add('hidden');
    routeBtn.disabled = false;

    document.body.classList.remove('navigation-active');
    setTimeout(() => { map.invalidateSize(); }, 300);

    if (navigationWatchId) {
        navigator.geolocation.clearWatch(navigationWatchId);
        navigationWatchId = null;
    }

    if (simulationIntervalId) {
        clearInterval(simulationIntervalId);
        simulationIntervalId = null;
    }

    // Zerar a localização desejada e limpar rota
    clearTrafficPolylines();
    
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    if (markerEnd) {
        map.removeLayer(markerEnd);
        markerEnd = null;
    }
    
    endCoords = null;
    routeEndInput.value = '';
    searchInput.value = ''; // Limpa também a pesquisa de sedes/locais
    viewRouteDetailsBtn.classList.add('hidden');
    routeSummaryCard.classList.add('hidden');
    routeOptionsModal.classList.add('hidden');
    routeDetailsModal.classList.add('hidden');
    clearRouteBtn.classList.add('hidden');
    startNavBtn.classList.add('hidden');

    // Restaura o ícone padrão de partida (pulse)
    const defaultStartIcon = L.divIcon({
        className: 'custom-gps-marker start',
        html: `<div class="marker-pulse start-pulse"></div>`,
        iconSize: [20, 20]
    });
    if (markerStart) {
        markerStart.setIcon(defaultStartIcon);
    }

    // Reseta a rotação do mapa
    const mapDiv = document.getElementById('map');
    if (mapDiv) {
        mapDiv.style.transform = 'none';
    }
}

// Funções para Controle de Modais de Rota
function showRouteOptionsModal(routes) {
    availableRoutes = routes;
    selectedRouteIndex = 0;
    
    routeOptionsList.innerHTML = '';
    
    routes.forEach((route, idx) => {
        const durationMins = Math.round(route.summary.totalTime / 60);
        const distanceKms = (route.summary.totalDistance / 1000).toFixed(1);
        
        // Simular trânsito para cada opção
        const trafficOptions = [
            { label: 'Trânsito Livre', color: '#2ecc71' },
            { label: 'Trânsito Moderado', color: '#f1c40f' },
            { label: 'Trânsito Intenso', color: '#e74c3c' }
        ];
        const traffic = idx === 0 ? trafficOptions[0] : trafficOptions[Math.min(idx, trafficOptions.length - 1)];
        
        const card = document.createElement('div');
        card.className = `route-option-card ${idx === 0 ? 'selected' : ''}`;
        card.dataset.index = idx;
        card.innerHTML = `
            <div class="option-details">
                <span class="option-name">${idx === 0 ? 'Rota Recomendada' : `Rota Alternativa ${idx}`}</span>
                <span class="option-meta">${distanceKms} km • <span style="color:${traffic.color}; font-weight:600">${traffic.label}</span></span>
            </div>
            <div class="option-time">
                <span class="time-val">${durationMins} min</span>
                <div class="option-select-indicator"></div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.route-option-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedRouteIndex = idx;
            
            // Desenha o overlay de trânsito correspondente para pré-visualizar
            drawTrafficOverlay(routes[idx]);
        });
        
        routeOptionsList.appendChild(card);
    });
    
    routeOptionsModal.classList.remove('hidden');
    lucide.createIcons();
}

window.closeRouteOptionsModal = function() {
    routeOptionsModal.classList.add('hidden');
};

window.confirmRouteSelection = function() {
    if (availableRoutes.length > 0) {
        const selectedRoute = availableRoutes[selectedRouteIndex];
        currentRouteData = selectedRoute;
        
        // Desenha o trânsito da rota escolhida
        drawTrafficOverlay(selectedRoute);
        
        showFeedback(`Rota confirmada: ${Math.round(selectedRoute.summary.totalTime / 60)} min`, 'success');
    }
    routeOptionsModal.classList.add('hidden');
};

window.openRouteDetailsModal = function() {
    if (!currentRouteData) return;
    
    const instructions = currentRouteData.instructions;
    routeDetailsList.innerHTML = `
        <div class="steps-list" style="max-height: 60vh; overflow-y: auto;">
            ${instructions.map((inst, index) => `
                <div class="route-step" style="padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-family: var(--font-body); font-size: 0.9rem; color: var(--text-primary);">
                    <strong style="color: var(--neon-cyan);">${index + 1}.</strong> ${inst.text} <span style="color:#53627c;">(${Math.round(inst.distance)}m)</span>
                </div>
            `).join('')}
        </div>
    `;
    routeDetailsModal.classList.remove('hidden');
};

window.closeRouteDetailsModal = function() {
    routeDetailsModal.classList.add('hidden');
};

// Bind click event para viewRouteDetailsBtn
if (viewRouteDetailsBtn) {
    viewRouteDetailsBtn.addEventListener('click', window.openRouteDetailsModal);
}

startNavBtn.addEventListener('click', startNavigation);
document.getElementById('stop-nav-btn').addEventListener('click', stopNavigation);

// Lógica de abas do celular (Mobile Bottom Tab Bar)
const tabWeatherBtn = document.getElementById('tab-weather-btn');
const tabGpsBtn = document.getElementById('tab-gps-btn');
const hudSidebar = document.getElementById('hud-sidebar');

if (tabWeatherBtn && tabGpsBtn && hudSidebar) {
    tabWeatherBtn.addEventListener('click', () => {
        hudSidebar.classList.remove('tab-gps');
        hudSidebar.classList.add('tab-weather');
        tabWeatherBtn.classList.add('active');
        tabGpsBtn.classList.remove('active');
    });
    tabGpsBtn.addEventListener('click', () => {
        hudSidebar.classList.remove('tab-weather');
        hudSidebar.classList.add('tab-gps');
        tabGpsBtn.classList.add('active');
        tabWeatherBtn.classList.remove('active');
    });
}


// Estilo customizado para os marcadores de GPS via CSS injetado
const markerStyle = document.createElement('style');
markerStyle.innerHTML = `
    .custom-gps-marker {
        display: flex;
        justify-content: center;
        align-items: center;
    }
    .marker-pulse {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid #fff;
    }
    .start-pulse {
        background-color: #00f0ff;
        box-shadow: 0 0 10px #00f0ff, 0 0 20px #00f0ff;
    }
    .end-pulse {
        background-color: #ff007f;
        box-shadow: 0 0 10px #ff007f, 0 0 20px #ff007f;
    }
    .marker-pulse-sede {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid #fff;
        background-color: #a100ff;
        box-shadow: 0 0 10px #a100ff, 0 0 20px #a100ff;
    }
`;
document.head.appendChild(markerStyle);

// Autocomplete de Sedes ao digitar
if (searchInput) {
    const suggestionsContainer = document.getElementById('sedes-suggestions');
    
    searchInput.addEventListener('input', (e) => {
        const rawQuery = e.target.value.toLowerCase();
        const query = rawQuery.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        if (query.length >= 2) {
            suggestionsContainer.innerHTML = '';
            const sedes = window.SEDES_DATABASE || {};
            let hasMatches = false;
            
            for (const key in sedes) {
                const nameNormalized = sedes[key].nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const addressNormalized = sedes[key].endereco.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                
                if (nameNormalized.includes(query) || addressNormalized.includes(query) || query.includes('sede')) {
                    hasMatches = true;
                    const sede = sedes[key];
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.innerHTML = `<i data-lucide="map-pin"></i> <div><strong>${sede.nome}</strong><br><small style="color:var(--text-muted); font-size:0.75rem">${sede.endereco}</small></div>`;
                    
                    item.addEventListener('click', () => {
                        searchInput.value = sede.nome;
                        suggestionsContainer.classList.add('hidden');
                        setDestination(sede.lat, sede.lng, sede.nome);
                        showFeedback(`Sucesso! Localizada a ${sede.nome}`, 'success');
                    });
                    
                    suggestionsContainer.appendChild(item);
                }
            }
            
            if (hasMatches) {
                suggestionsContainer.classList.remove('hidden');
                lucide.createIcons();
            } else {
                suggestionsContainer.classList.add('hidden');
            }
        } else {
            suggestionsContainer.classList.add('hidden');
        }
    });

    // Fecha sugestões ao clicar fora do campo
    document.addEventListener('click', (e) => {
        if (suggestionsContainer && !suggestionsContainer.contains(e.target) && e.target !== searchInput) {
            suggestionsContainer.classList.add('hidden');
        }
    });
}

// Inicialização imediata
window.onload = initMap;
