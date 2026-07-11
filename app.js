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
const navSpeed = document.getElementById('nav-speed');
const navEta = document.getElementById('nav-eta');
const navTraffic = document.getElementById('nav-traffic');

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
let simulationIntervalId = null;
let currentRouteData = null;
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
        setDestination(e.latlng.lat, e.latlng.lng, `Ponto no Mapa (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
    });

    // Inicia geolocalização do usuário para ponto de partida
    getUserLocation();
}

// 3. Geolocalização do Usuário (GPS Partida)
function getUserLocation() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                startCoords = { lat, lng };
                routeStartInput.value = "Minha Localização Atual";
                
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

// 4. Buscar e Resolver Endereços (CEP ou Texto)
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showFeedback('Por favor, insira um local ou CEP.', 'error');
        return;
    }

    showFeedback('Processando busca climática e mapeamento...', 'loading');

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
            'User-Agent': 'GeoWeatherApp/1.0 (leandro.lopes@example.com)'
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

    showFeedback('Gerando diretrizes de rota...', 'loading');

    routingControl = L.Routing.control({
        waypoints: [
            L.latLng(startCoords.lat, startCoords.lng),
            L.latLng(endCoords.lat, endCoords.lng)
        ],
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            language: 'pt-BR'
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
        const summary = routes[0].summary;
        const instructions = routes[0].instructions;
        
        currentRouteData = routes[0];
        startNavBtn.classList.remove('hidden');

        // Converter tempo de segundos para minutos legíveis
        const durationMins = Math.round(summary.totalTime / 60);
        const distanceKms = (summary.totalDistance / 1000).toFixed(1);

        // Preenche painel customizado de GPS
        routeInstructions.innerHTML = `
            <div class="route-summary" style="margin-bottom:10px; font-weight:700; color:#00f0ff;">
                <i data-lucide="info"></i> ROTA GERADA: ${distanceKms} km (~${durationMins} min)
            </div>
            <div class="steps-list">
                ${instructions.map((inst, index) => `
                    <div class="route-step">
                        <strong>${index + 1}.</strong> ${inst.text} <span style="color:#53627c;">(${Math.round(inst.distance)}m)</span>
                    </div>
                `).join('')}
            </div>
        `;
        routeInstructions.classList.remove('hidden');
        clearRouteBtn.classList.remove('hidden');
        showFeedback('Diretrizes de navegação carregadas com sucesso.', 'success');
        
        // Calcular e desenhar o Trânsito
        drawTrafficOverlay(currentRouteData);

        lucide.createIcons();

        // Ajusta o zoom do mapa para englobar toda a rota
        const bounds = L.latLngBounds([
            [startCoords.lat, startCoords.lng],
            [endCoords.lat, endCoords.lng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
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
    routeInstructions.innerHTML = '';
    routeInstructions.classList.add('hidden');
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
    
    const distanceKms = (route.summary.totalDistance / 1000).toFixed(1);
    routeInstructions.querySelector('.route-summary').innerHTML = `
        <i data-lucide="info"></i> ROTA GERADA: ${distanceKms} km (~${finalEta} min) <br>
        <span style="font-size:0.75rem; color:${randomTraffic.color}">Trânsito: ${randomTraffic.label} (+${trafficDelay}m)</span>
    `;
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
    startNavBtn.classList.add('hidden');
    clearRouteBtn.classList.add('hidden');
    routeBtn.disabled = true;

    // Ativa classe de navegação no body (CSS esconde header/sidebar e expande mapa)
    document.body.classList.add('navigation-active');
    setTimeout(() => { map.invalidateSize(); }, 300);

    const coords = currentRouteData.coordinates;
    const instructions = currentRouteData.instructions;
    let currentCoordsIdx = 0;

    showFeedback('Navegação GPS simulada iniciada.', 'success');

    if (!markerStart) {
        const customStartIcon = L.divIcon({
            className: 'custom-gps-marker start',
            html: `<div class="marker-pulse start-pulse"></div>`,
            iconSize: [20, 20]
        });
        markerStart = L.marker([coords[0].lat, coords[0].lng], { icon: customStartIcon }).addTo(map);
    }

    if ('geolocation' in navigator) {
        navigationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                markerStart.setLatLng([lat, lng]);
                map.setView([lat, lng], 17);
                const speed = position.coords.speed ? Math.round(position.coords.speed * 3.6) : 0;
                navSpeed.innerText = `${speed} km/h`;
            },
            (err) => console.warn(err),
            { enableHighAccuracy: true }
        );
    }

    simulationIntervalId = setInterval(() => {
        if (currentCoordsIdx >= coords.length) {
            stopNavigation();
            showFeedback('Destino alcançado!', 'success');
            return;
        }

        const currentPos = coords[currentCoordsIdx];
        markerStart.setLatLng([currentPos.lat, currentPos.lng]);
        map.setView([currentPos.lat, currentPos.lng], 16);

        const baseSpeed = navTraffic.innerText === 'LIVRE' ? 60 : navTraffic.innerText === 'MODERADO' ? 35 : 12;
        const randomSpeed = baseSpeed + Math.floor(Math.random() * 11) - 5;
        navSpeed.innerText = `${Math.max(5, randomSpeed)} km/h`;

        let activeInstruction = instructions[0];
        let minDist = Infinity;
        
        instructions.forEach(inst => {
            const instCoord = coords[inst.index];
            if (instCoord) {
                const d = map.distance([currentPos.lat, currentPos.lng], [instCoord.lat, instCoord.lng]);
                if (inst.index > currentCoordsIdx && d < minDist) {
                    minDist = d;
                    activeInstruction = inst;
                }
            }
        });

        if (activeInstruction) {
            navNextStep.innerText = activeInstruction.text;
            navNextDist.innerText = `a ${Math.round(minDist)} metros`;
        }

        const progressRatio = currentCoordsIdx / coords.length;
        const totalEtaText = navEta.innerText.split(' ')[0];
        const totalEta = parseInt(totalEtaText) || 10;
        const remainingEta = Math.max(1, Math.round(totalEta * (1 - progressRatio)));
        navEta.innerText = `${remainingEta} min`;

        currentCoordsIdx += Math.max(1, Math.floor(coords.length / 80));
    }, 1500);
}

function stopNavigation() {
    isNavigating = false;
    gpsNavHud.classList.add('hidden');
    if (currentRouteData) {
        startNavBtn.classList.remove('hidden');
        clearRouteBtn.classList.remove('hidden');
    }
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
}

startNavBtn.addEventListener('click', startNavigation);
document.getElementById('stop-nav-btn').addEventListener('click', stopNavigation);


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
`;
document.head.appendChild(markerStyle);

// Inicialização imediata
window.onload = initMap;
