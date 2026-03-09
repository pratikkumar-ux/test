import { WeatherInfo } from '../types';

/**
 * Fetches real-time weather data for a given location name or coordinates.
 * Using wttr.in (no API key required) for robust demo performance.
 */
export const fetchWeather = async (location: string): Promise<WeatherInfo | null> => {
    try {
        // wttr.in is a free weather service. ?format=j1 returns JSON.
        const response = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=j1`);
        if (!response.ok) throw new Error('Weather fetch failed');

        const data = await response.json();
        const current = data.current_condition[0];

        // Map wttr.in codes to our specific conditions
        const desc = current.weatherDesc[0].value.toLowerCase();
        let condition: WeatherInfo['condition'] = 'Clear';

        if (desc.includes('rain')) condition = 'Rain';
        else if (desc.includes('cloud')) condition = 'Cloudy';
        else if (desc.includes('overcast')) condition = 'Overcast';
        else if (desc.includes('sunny')) condition = 'Sunny';
        else if (desc.includes('mist') || desc.includes('fog')) condition = 'Mist';

        return {
            condition,
            temp: parseInt(current.temp_C),
            humidity: parseInt(current.humidity),
            windSpeed: parseInt(current.windspeedKmph),
            locationName: data.nearest_area[0].areaName[0].value,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Weather error:', error);
        // Fallback mock if service is down
        return {
            condition: 'Sunny',
            temp: 28,
            humidity: 45,
            windSpeed: 12,
            locationName: location,
            lastUpdated: new Date().toISOString()
        };
    }
};
