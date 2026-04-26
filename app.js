const weatherLookup = {
    0: { desc: "Clear Sky", icon: "☀️" },
    1: { desc: "Mainly Clear", icon: "🌤️" },
    2: { desc: "Partly Cloudy", icon: "⛅" },
    3: { desc: "Overcast", icon: "☁️" },
    45: { desc: "Foggy", icon: "🌫️" },
    51: { desc: "Drizzle", icon: "🌦️" },
    61: { desc: "Rain", icon: "🌧️" },
    71: { desc: "Snow", icon: "❄️" },
    95: { desc: "Thunderstorm", icon: "⛈️" }
};

function debounce(func, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}

const handleSearch = debounce(async () => {
    const city = document.getElementById('cityInput').value.trim();
    const validationMsg = document.getElementById('validationMsg');

    if (city.length < 2) {
        validationMsg.style.display = 'block';
        return;
    }
    validationMsg.style.display = 'none';
    toggleSkeletons(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${city}&count=1`, { signal: controller.signal });
        if (!geoRes.ok) throw new Error(`HTTP Error: ${geoRes.status}`); 
        
        const geoData = await geoRes.json();
        if (!geoData.results) {
            showError("City not found. Try another."); 
            return;
        }

        const { latitude, longitude, name, timezone } = geoData.results[0];

        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
        const weatherRes = await fetch(weatherUrl, { signal: controller.signal });
        if (!weatherRes.ok) throw new Error(`HTTP Error: ${weatherRes.status}`);

        const weatherData = await weatherRes.json();
        clearTimeout(timeoutId);

        updateWeatherUI(name, weatherData);
        
        fetchLocalTime(timezone);

    } catch (err) {
        showError(err.name === 'AbortError' ? "Request Timed Out" : err.message);
    } finally {
        toggleSkeletons(false);
    }
}, 500);

function fetchLocalTime(tz) {
    $.getJSON(`https://worldtimeapi.org/api/timezone/${tz}`)
        .done((data) => {
            const time = new Date(data.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            $('#localTime').text(time);
        })
        .fail(() => {
            // Fallback [cite: 51]
            $('#localTime').text(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (Local)");
        })
        .always(() => {
            console.log(`[${new Date().toISOString()}] Time sync completed.`);
        });
}

function updateWeatherUI(name, data) {
    const current = data.current_weather;
    const info = weatherLookup[current.weathercode] || { desc: "Cloudy", icon: "☁️" };

    document.getElementById('cityName').textContent = name;
    document.getElementById('temp').textContent = `${Math.round(current.temperature)}°C`;
    document.getElementById('description').textContent = `${info.icon} ${info.desc}`;
    document.getElementById('humidity').textContent = `72%`; 
    document.getElementById('wind').textContent = `${current.windspeed} km/h`;

    const forecastRow = document.getElementById('forecastRow');
    forecastRow.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
        const dayInfo = weatherLookup[data.daily.weathercode[i]] || { icon: "☁️" };
        const dayCard = document.createElement('div');
        dayCard.className = 'forecast-card';
        dayCard.innerHTML = `
            <p style="font-weight:600">Day ${i+1}</p>
            <div style="font-size:1.8rem; margin:10px 0">${dayInfo.icon}</div>
            <p>${Math.round(data.daily.temperature_2m_max[i])}° / ${Math.round(data.daily.temperature_2m_min[i])}°</p>
        `;
        forecastRow.appendChild(dayCard);
    }
}

function toggleSkeletons(active) {
    document.querySelectorAll('.skeleton-text').forEach(el => {
        active ? el.classList.add('skeleton') : el.classList.remove('skeleton');
    });
}

function showError(msg) {
    const banner = document.getElementById('errorBanner');
    document.getElementById('errorMsg').textContent = `❌ Error: ${msg}`;
    banner.style.display = 'block';
    toggleSkeletons(false);
}

document.getElementById('searchBtn').addEventListener('click', handleSearch);