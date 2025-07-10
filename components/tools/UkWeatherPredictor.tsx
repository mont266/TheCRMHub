
import React, { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { ToolProps } from '../../types';
import { ArrowLeftIcon, XMarkIcon } from '../icons'; // Import XMarkIcon

// --- CONSTANTS ---
const API_KEY = '34285941a5314c92a81123428252805'; 

const DEFAULT_WIND_THRESHOLD_MPH = 37.28;
const DEFAULT_RAIN_THRESHOLD_MM_HR = 5;
const DEFAULT_HEATWAVE_THRESHOLD_C = 25; // Will apply to "feels like" temp
const DEFAULT_CONSECUTIVE_DAYS = 3;
const DEFAULT_ICE_TEMP_THRESHOLD_C = 0.5;
const DEFAULT_ICY_HUMIDITY_THRESHOLD = 85; // Percent

const UK_COUNTIES_BY_CATEGORY = {
    "England": [
        "Bedfordshire", "Berkshire", "Bristol", "Buckinghamshire", "Cambridgeshire",
        "Cheshire", "Cornwall", "County Durham", "Cumbria", "Derbyshire",
        "Devon", "Dorset", "East Sussex", "Essex", "Gloucestershire",
        "Greater London", "Greater Manchester", "Hampshire", "Herefordshire",
        "Hertfordshire", "Isle of Wight", "Kent", "Lancashire", "Leicestershire",
        "Lincolnshire", "Merseyside", "Norfolk", "Northamptonshire", "Northumberland",
        "North Yorkshire", "Nottinghamshire", "Oxfordshire", "Rutland",
        "Shropshire", "Somerset", "South Yorkshire", "Staffordshire", "Suffolk",
        "Surrey", "Tyne and Wear", "Warwickshire", "West Midlands", "West Sussex",
        "West Yorkshire", "Wiltshire", "Worcestershire"
    ].sort(),
    "Scotland": [
        "Aberdeenshire", "Angus", "Argyll and Bute", "City of Edinburgh",
        "Clackmannanshire", "Dumfries and Galloway", "Dundee", "East Ayrshire",
        "East Dunbartonshire", "East Lothian", "East Renfrewshire", "Falkirk",
        "Fife", "Glasgow", "Highland", "Midlothian",
        "Moray", "Na h-Eileanan Siar", "North Ayrshire", "North Lanarkshire",
        "Orkney Islands", "Perth and Kinross", "Renfrewshire", "Scottish Borders",
        "Shetland Islands", "South Ayrshire", "South Lanarkshire", "Stirling",
        "West Dunbartonshire", "West Lothian"
    ].sort(),
    "Wales": [
        "Blaenau Gwent", "Bridgend", "Caerphilly", "Cardiff", "Carmarthenshire",
        "Ceredigion", "Conwy", "Denbighshire", "Flintshire", "Gwynedd",
        "Isle of Anglesey", "Merthyr Tydfil", "Monmouthshire", "Neath Port Talbot",
        "Newport", "Pembrokeshire", "Powys", "Rhondda Cynon Taf", "Swansea",
        "Torfaen", "Vale of Glamorgan", "Wrexham"
    ].sort(),
    "Northern Ireland": [
        "Antrim", "Ards", "Armagh", "Ballymena", "Ballymoney", "Banbridge",
        "Belfast", "Carrickfergus", "Castlereagh", "Coleraine",
        "Cookstown", "Craigavon", "Derry", "Down", "Dungannon",
        "Fermanagh", "Larne", "Limavady", "Lisburn", "Magherafelt",
        "Moyle", "Newry and Mourne", "Newtownabbey", "North Down", "Omagh",
        "Strabane"
    ].sort()
};

const CHECKMARK_SVG_DATA_URI = "data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e";

// WeatherAPI condition codes
const THUNDERSTORM_CODES = [1087, 1273, 1276, 1279, 1282];
const FREEZING_PRECIP_CODES = [1198, 1201, 1204, 1207, 1249, 1252, 1261, 1264]; // Freezing rain, sleet, ice pellets

interface OfficialAlert {
    headline: string;
    msgtype: string | null;
    severity: string | null;
    urgency: string | null;
    areas: string | null;
    category: string;
    certainty: string | null;
    event: string;
    note: string | null;
    effective: string; 
    expires: string; 
    desc: string;
    instruction: string | null;
}

interface CountyWeatherData {
    county: string;
    country: string;
    hasWarning: boolean; 
    isPredictedThresholdWarning: boolean; 
    reason: string[]; 
    officialAlerts: OfficialAlert[] | null;
    hasHeatwave: boolean; 
    heatwaveMessage: string;
    hasStormWarning: boolean; // True if our custom wind/rain, OR thunderstorm code
    stormMessage: string;
    showsStormIcon: boolean; // Specifically for our wind+rain threshold icon
    hasIceRisk: boolean;
    iceRiskMessage: string;
    error?: boolean;
    errorMessage?: string;
    detailsExpanded?: boolean; 
    isManuallyOverridden?: boolean;
}

interface ManualOverrides {
    [key: string]: boolean; 
}

type WarningTypeFilterValue = 'all' | 'official' | 'storm' | 'heatwave' | 'ice';

const formatDateSafe = (dateString: string | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A'; 
    return date.toLocaleString('en-GB', options);
};

const UkWeatherPredictor: React.FC<ToolProps> = ({ onClose, theme }) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [rawWeatherData, setRawWeatherData] = useState<CountyWeatherData[]>([]);
    const [weatherData, setWeatherData] = useState<CountyWeatherData[]>([]);
    const [fetchStatusMessage, setFetchStatusMessage] = useState<string>('');
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    
    // Filtering state
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showOnlyWarnings, setShowOnlyWarnings] = useState<boolean>(false);
    const [countryFilter, setCountryFilter] = useState<string>('all'); // 'all' or specific country name
    const [warningTypeFilter, setWarningTypeFilter] = useState<WarningTypeFilterValue>('all');


    const [isDevToolsVisible, setIsDevToolsVisible] = useState<boolean>(false);
    const [currentWindThresholdMph, setCurrentWindThresholdMph] = useState<number>(DEFAULT_WIND_THRESHOLD_MPH);
    const [currentRainThresholdMmHr, setCurrentRainThresholdMmHr] = useState<number>(DEFAULT_RAIN_THRESHOLD_MM_HR);
    const [currentHeatwaveThresholdC, setCurrentHeatwaveThresholdC] = useState<number>(DEFAULT_HEATWAVE_THRESHOLD_C);
    const [currentConsecutiveDays, setCurrentConsecutiveDays] = useState<number>(DEFAULT_CONSECUTIVE_DAYS);
    const [currentIceTempThresholdC, setCurrentIceTempThresholdC] = useState<number>(DEFAULT_ICE_TEMP_THRESHOLD_C);
    const [currentIcyHumidityThreshold, setCurrentIcyHumidityThreshold] = useState<number>(DEFAULT_ICY_HUMIDITY_THRESHOLD);

    const [simulateStorm, setSimulateStorm] = useState<boolean>(false);
    const [simulateHeatwave, setSimulateHeatwave] = useState<boolean>(false);
    const [simulateIceRisk, setSimulateIceRisk] = useState<boolean>(false);

    const [manualOverrides, setManualOverrides] = useState<ManualOverrides>({});
    const [selectedCountryForOverride, setSelectedCountryForOverride] = useState<string>(Object.keys(UK_COUNTIES_BY_CATEGORY)[0] || '');
    const [selectedCountyForOverride, setSelectedCountyForOverride] = useState<string>('');

    const windInputRef = useRef<HTMLInputElement>(null);
    const rainInputRef = useRef<HTMLInputElement>(null);
    const heatwaveInputRef = useRef<HTMLInputElement>(null);
    const consecutiveDaysInputRef = useRef<HTMLInputElement>(null);
    const iceTempInputRef = useRef<HTMLInputElement>(null);
    const icyHumidityInputRef = useRef<HTMLInputElement>(null);
    const fetchWeatherBtnRef = useRef<HTMLButtonElement>(null);

    const loadDevThresholds = useCallback(() => {
        const storedWind = localStorage.getItem('dev_windThreshold');
        const storedRain = localStorage.getItem('dev_rainThreshold');
        const storedHeatwave = localStorage.getItem('dev_heatwaveThreshold');
        const storedConsecutiveDays = localStorage.getItem('dev_consecutiveDays');
        const storedIceTemp = localStorage.getItem('dev_iceTempThreshold');
        const storedIcyHumidity = localStorage.getItem('dev_icyHumidityThreshold');

        const wind = storedWind ? parseFloat(storedWind) : DEFAULT_WIND_THRESHOLD_MPH;
        const rain = storedRain ? parseFloat(storedRain) : DEFAULT_RAIN_THRESHOLD_MM_HR;
        const heatwave = storedHeatwave ? parseFloat(storedHeatwave) : DEFAULT_HEATWAVE_THRESHOLD_C;
        const days = storedConsecutiveDays ? parseInt(storedConsecutiveDays) : DEFAULT_CONSECUTIVE_DAYS;
        const iceTemp = storedIceTemp ? parseFloat(storedIceTemp) : DEFAULT_ICE_TEMP_THRESHOLD_C;
        const icyHumidity = storedIcyHumidity ? parseInt(storedIcyHumidity) : DEFAULT_ICY_HUMIDITY_THRESHOLD;
        
        setCurrentWindThresholdMph(wind);
        setCurrentRainThresholdMmHr(rain);
        setCurrentHeatwaveThresholdC(heatwave);
        setCurrentConsecutiveDays(days);
        setCurrentIceTempThresholdC(iceTemp);
        setCurrentIcyHumidityThreshold(icyHumidity);

        if (windInputRef.current) windInputRef.current.value = wind.toFixed(2);
        if (rainInputRef.current) rainInputRef.current.value = rain.toFixed(1);
        if (heatwaveInputRef.current) heatwaveInputRef.current.value = heatwave.toString();
        if (consecutiveDaysInputRef.current) consecutiveDaysInputRef.current.value = days.toString();
        if (iceTempInputRef.current) iceTempInputRef.current.value = iceTemp.toFixed(1);
        if (icyHumidityInputRef.current) icyHumidityInputRef.current.value = icyHumidity.toString();

    }, []);

    const saveDevThresholds = useCallback(() => {
        localStorage.setItem('dev_windThreshold', currentWindThresholdMph.toString());
        localStorage.setItem('dev_rainThreshold', currentRainThresholdMmHr.toString());
        localStorage.setItem('dev_heatwaveThreshold', currentHeatwaveThresholdC.toString());
        localStorage.setItem('dev_consecutiveDays', currentConsecutiveDays.toString());
        localStorage.setItem('dev_iceTempThreshold', currentIceTempThresholdC.toString());
        localStorage.setItem('dev_icyHumidityThreshold', currentIcyHumidityThreshold.toString());
    }, [currentWindThresholdMph, currentRainThresholdMmHr, currentHeatwaveThresholdC, currentConsecutiveDays, currentIceTempThresholdC, currentIcyHumidityThreshold]);
    
    const loadManualOverrides = useCallback(() => {
        const storedOverrides = localStorage.getItem('dev_manualOverrides');
        if (storedOverrides) {
            try {
                setManualOverrides(JSON.parse(storedOverrides));
            } catch (e) { console.error("Failed to parse manual overrides", e); setManualOverrides({}); }
        }
    }, []);

    const saveManualOverrides = useCallback(() => {
        localStorage.setItem('dev_manualOverrides', JSON.stringify(manualOverrides));
    }, [manualOverrides]);

    useEffect(() => { loadDevThresholds(); loadManualOverrides(); }, [loadDevThresholds, loadManualOverrides]);
    useEffect(() => { saveManualOverrides(); }, [manualOverrides, saveManualOverrides]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.ctrlKey && event.shiftKey && (event.key === 'F' || event.key === 'f')) {
                event.preventDefault();
                setIsDevToolsVisible(prev => { if (!prev) { loadDevThresholds(); loadManualOverrides(); } return !prev; });
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isDevToolsVisible, loadDevThresholds, loadManualOverrides]);
    
    useEffect(() => {
        const button = fetchWeatherBtnRef.current;
        const handleContextMenu = (event: MouseEvent) => {
            event.preventDefault();
            setIsDevToolsVisible(prev => { if (!prev) { loadDevThresholds(); loadManualOverrides(); } return !prev; });
        };
        if (button) button.addEventListener('contextmenu', handleContextMenu);
        return () => { if (button) button.removeEventListener('contextmenu', handleContextMenu); };
    }, [isDevToolsVisible, loadDevThresholds, loadManualOverrides]);

    const handleFetchWeatherData = useCallback(async () => {
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'fetch_weather_data');
        }
        if (!API_KEY) { 
            setFetchStatusMessage('Error: API Key not configured.'); setIsLoading(false); return;
        }
        setIsLoading(true);
        setFetchStatusMessage('Initializing data fetch...');
        setRawWeatherData([]); setWeatherData([]); setLastUpdated(null);

        const allCounties = Object.entries(UK_COUNTIES_BY_CATEGORY).flatMap(([country, counties]) => 
            counties.map(countyName => ({ name: countyName, country }))
        );
        const totalCountiesToFetch = allCounties.length;
        const fetchedDataResults: CountyWeatherData[] = [];

        for (let i = 0; i < allCounties.length; i++) {
            const { name: county, country } = allCounties[i];
            const index = i;
            
            const message = `Loading data for ${county}, ${country} (${index + 1}/${totalCountiesToFetch})...`;
            setFetchStatusMessage(message);
            await new Promise(resolve => setTimeout(resolve, 20)); // Yield to event loop
            
            const url = `https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(county)},UK&days=4&aqi=no&alerts=yes`;
            let countyResult: CountyWeatherData;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                     countyResult = { county, country, hasWarning: false, isPredictedThresholdWarning: false, reason: [], officialAlerts: null,
                              hasHeatwave: false, heatwaveMessage: '', hasStormWarning: false, stormMessage: '', showsStormIcon: false,
                              hasIceRisk: false, iceRiskMessage: '', error: true, errorMessage: `API Error ${response.status}`, detailsExpanded: false };
                } else {
                    const data = await response.json();

                    let processedOfficialAlerts: OfficialAlert[] = [];
                    if (data.alerts && data.alerts.alert && data.alerts.alert.length > 0) {
                        const seenAlerts = new Set<string>();
                        // Ensure data.alerts.alert is an array before iterating
                        const alertsArray = Array.isArray(data.alerts.alert) ? data.alerts.alert : [data.alerts.alert];
                        alertsArray.forEach((rawAlert: any) => {
                            const alertKey = `${(rawAlert.event || '').trim()}|${(rawAlert.headline || '').trim()}|${(rawAlert.effective || '').trim()}`;
                            if (!seenAlerts.has(alertKey)) {
                                seenAlerts.add(alertKey);
                                processedOfficialAlerts.push({
                                    headline: rawAlert.headline,
                                    msgtype: rawAlert.msgtype,
                                    severity: rawAlert.severity,
                                    urgency: rawAlert.urgency,
                                    areas: rawAlert.areas,
                                    category: rawAlert.category,
                                    certainty: rawAlert.certainty,
                                    event: rawAlert.event,
                                    note: rawAlert.note,
                                    effective: rawAlert.effective,
                                    expires: rawAlert.expires,
                                    desc: rawAlert.desc,
                                    instruction: rawAlert.instruction,
                                });
                            }
                        });
                    }
                    const officialAlertsData: OfficialAlert[] | null = processedOfficialAlerts.length > 0 ? processedOfficialAlerts : null;
                    const hasOfficialApiAlerts = !!officialAlertsData;


                    let isPredictedThresholdMet = false;
                    let predictionDetails: string[] = [];
                    
                    let predictedStorm = false;
                    let stormMsg = '';
                    let showStormSpecificIcon = false;

                    let predictedHeatwave = false;
                    let heatwaveMsg = '';

                    let predictedIceRisk = false;
                    let iceRiskMsg = '';

                    const currentWindMph = data.current?.wind_mph || 0;
                    const currentGustMph = data.current?.gust_mph || currentWindMph;
                    const currentPrecipMm = data.current?.precip_mm || 0;

                    if (currentGustMph > currentWindThresholdMph || currentPrecipMm > currentRainThresholdMmHr) {
                        isPredictedThresholdMet = true;
                        let currentConditions: string[] = [];
                        if (currentGustMph > currentWindThresholdMph) currentConditions.push(`Wind ${currentGustMph.toFixed(1)}mph (gust)`);
                        if (currentPrecipMm > currentRainThresholdMmHr) currentConditions.push(`Rain ${currentPrecipMm.toFixed(1)}mm/hr`);
                        predictionDetails.push(`Current: ${currentConditions.join(' & ')}`);
                    }
                    
                    if (data.forecast?.forecastday) {
                        let hourlyForecastDetails: string[] = [];
                        let daysMeetingHeatwaveFeelsLikeCriteria = 0;
                        
                        for (let dayIdx = 0; dayIdx < data.forecast.forecastday.length; dayIdx++) {
                            const dayForecast = data.forecast.forecastday[dayIdx];
                            let dayHadHourMeetingHeatwaveFeelsLike = false;

                            if (dayForecast.hour) {
                                for (const hourData of dayForecast.hour) {
                                    const forecastWindMph = hourData.wind_mph || 0;
                                    const forecastGustMph = hourData.gust_mph || forecastWindMph;
                                    const forecastPrecipMm = hourData.precip_mm || 0;
                                    const forecastTempC = hourData.temp_c;
                                    const forecastFeelsLikeC = hourData.feelslike_c;
                                    const forecastConditionCode = hourData.condition?.code;
                                    const forecastDewpointC = hourData.dewpoint_c;
                                    const forecastHumidity = hourData.humidity;

                                    let conditionsAtHour: string[] = [];
                                    if (forecastGustMph > currentWindThresholdMph) conditionsAtHour.push(`Wind ${forecastGustMph.toFixed(1)}mph (gust)`);
                                    if (forecastPrecipMm > currentRainThresholdMmHr) conditionsAtHour.push(`Rain ${forecastPrecipMm.toFixed(1)}mm/hr`);

                                    if (conditionsAtHour.length > 0) {
                                        isPredictedThresholdMet = true;
                                        const dateTime = formatDateSafe(hourData.time, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                        hourlyForecastDetails.push(`${dateTime}: ${conditionsAtHour.join(', ')}`);
                                    }

                                    if (forecastGustMph > currentWindThresholdMph && forecastPrecipMm > currentRainThresholdMmHr) {
                                        if(!predictedStorm || !showStormSpecificIcon) {
                                          predictedStorm = true;
                                          showStormSpecificIcon = true;
                                          const stormDateTime = formatDateSafe(hourData.time, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                          stormMsg = `High Wind & Rain: ${stormDateTime} (Gust ${forecastGustMph.toFixed(1)}mph & Rain ${forecastPrecipMm.toFixed(1)}mm/hr)`;
                                        }
                                    }
                                    if (forecastConditionCode && THUNDERSTORM_CODES.includes(forecastConditionCode)) {
                                        if (!predictedStorm || !stormMsg.toLowerCase().includes('thunder')) {
                                            predictedStorm = true;
                                            const thunderDateTime = formatDateSafe(hourData.time, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                            stormMsg = stormMsg ? `${stormMsg}. Also, Thunderstorm predicted: ${thunderDateTime}` : `Thunderstorm predicted: ${thunderDateTime}`;
                                        }
                                    }
                                    
                                    if (forecastFeelsLikeC >= currentHeatwaveThresholdC) {
                                        dayHadHourMeetingHeatwaveFeelsLike = true;
                                    }

                                    const isFreezingPrecip = forecastTempC <= currentIceTempThresholdC && forecastPrecipMm > 0 && forecastConditionCode && FREEZING_PRECIP_CODES.includes(forecastConditionCode);
                                    const isFrostRisk = forecastTempC <= currentIceTempThresholdC && forecastDewpointC <= currentIceTempThresholdC && forecastHumidity >= currentIcyHumidityThreshold;

                                    if (isFreezingPrecip || isFrostRisk) {
                                        if (!predictedIceRisk) {
                                            predictedIceRisk = true;
                                            const iceDateTime = formatDateSafe(hourData.time, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                                            iceRiskMsg = isFreezingPrecip 
                                                ? `Risk of freezing precipitation around ${iceDateTime} (Temp: ${forecastTempC}°C, Precip: ${forecastPrecipMm}mm)`
                                                : `Conditions favorable for frost/ice around ${iceDateTime} (Temp: ${forecastTempC}°C, Dewpoint: ${forecastDewpointC}°C, Humidity: ${forecastHumidity}%)`;
                                        }
                                    }
                                }
                            }
                            if (dayHadHourMeetingHeatwaveFeelsLike) daysMeetingHeatwaveFeelsLikeCriteria++; else daysMeetingHeatwaveFeelsLikeCriteria = 0;

                            if (daysMeetingHeatwaveFeelsLikeCriteria >= currentConsecutiveDays && !predictedHeatwave) {
                                 predictedHeatwave = true;
                                 let totalHotDays = 0;
                                 for(let k=dayIdx - currentConsecutiveDays + 1; k < data.forecast.forecastday.length; k++){
                                    if(k < 0) continue; // Ensure we don't go out of bounds
                                    let dayIsHot = false;
                                    for(const hr of data.forecast.forecastday[k].hour){
                                        if(hr.feelslike_c >= currentHeatwaveThresholdC) {
                                            dayIsHot = true; break;
                                        }
                                    }
                                    if(dayIsHot) totalHotDays++; else break;
                                 }
                                 heatwaveMsg = `Expected: ${totalHotDays} days with "feels like" > ${currentHeatwaveThresholdC}°C`;
                            }
                        }
                        if (hourlyForecastDetails.length > 0) {
                            predictionDetails.push('Forecasted (Thresholds):');
                            predictionDetails = predictionDetails.concat(hourlyForecastDetails.slice(0, 5)); 
                            if (hourlyForecastDetails.length > 5) predictionDetails.push('(...more hours predicted)');
                        }
                    }
                    if (isPredictedThresholdMet && predictionDetails.length === 0) {
                        predictionDetails.push("Thresholds met (current/forecast), specific hourly details limited or unavailable.");
                    }
                    
                    const overallHasWarning = isPredictedThresholdMet || hasOfficialApiAlerts || predictedHeatwave || predictedStorm || predictedIceRisk;

                    countyResult = { county, country, hasWarning: overallHasWarning, isPredictedThresholdWarning: isPredictedThresholdMet, reason: predictionDetails, 
                                     officialAlerts: officialAlertsData, hasHeatwave: predictedHeatwave, heatwaveMessage: heatwaveMsg, 
                                     hasStormWarning: predictedStorm, stormMessage: stormMsg, showsStormIcon: showStormSpecificIcon,
                                     hasIceRisk: predictedIceRisk, iceRiskMessage: iceRiskMsg,
                                     detailsExpanded: false, error: false };
                }
            } catch (error: any) {
                 countyResult = { county, country, hasWarning: false, isPredictedThresholdWarning: false, reason: [], officialAlerts: null,
                                  hasHeatwave: false, heatwaveMessage: '', hasStormWarning: false, stormMessage: '', showsStormIcon: false,
                                  hasIceRisk: false, iceRiskMessage: '', error: true, errorMessage: `Fetch Error: ${error.message}`, detailsExpanded: false };
            }
            fetchedDataResults.push(countyResult);
        }
        
        setRawWeatherData(fetchedDataResults);
        setIsLoading(false); 
        setLastUpdated(new Date());
        setFetchStatusMessage(fetchedDataResults.some(r => r.error) ? 'Loading complete, some data may be missing.' : 'Loading successful!');

    }, [currentWindThresholdMph, currentRainThresholdMmHr, currentHeatwaveThresholdC, currentConsecutiveDays, currentIceTempThresholdC, currentIcyHumidityThreshold]);
    

    useEffect(() => {
        if (!rawWeatherData.length) { setWeatherData([]); return; }

        let processedData = JSON.parse(JSON.stringify(rawWeatherData)) as CountyWeatherData[]; 

        processedData = processedData.map(item => {
            const overrideKey = `${item.county}-${item.country}`;
            const isManuallyOverridden = !!manualOverrides[overrideKey];

            let finalOverallWarning = item.hasWarning;
            let finalStormWarning = item.hasStormWarning;
            let finalStormMessage = item.stormMessage;
            let finalShowsStormIcon = item.showsStormIcon;
            let finalHeatwave = item.hasHeatwave;
            let finalHeatwaveMessage = item.heatwaveMessage;
            let finalIceRisk = item.hasIceRisk;
            let finalIceRiskMessage = item.iceRiskMessage;

            if (simulateStorm) {
                finalOverallWarning = true; finalStormWarning = true; finalShowsStormIcon = true;
                finalStormMessage = "Simulated Storm Conditions (Dev Tools)";
            }
            if (simulateHeatwave) {
                finalOverallWarning = true; finalHeatwave = true;
                finalHeatwaveMessage = `Simulated Heatwave: "Feels like" >${currentHeatwaveThresholdC}°C for ${currentConsecutiveDays} days (Dev Tools)`;
            }
            if (simulateIceRisk) {
                finalOverallWarning = true; finalIceRisk = true;
                finalIceRiskMessage = `Simulated Ice Risk: Temp <${currentIceTempThresholdC}°C (Dev Tools)`;
            }
            if (isManuallyOverridden) {
                finalOverallWarning = true;
            }

            return { ...item, hasWarning: finalOverallWarning, hasStormWarning: finalStormWarning, stormMessage: finalStormMessage, showsStormIcon: finalShowsStormIcon,
                     hasHeatwave: finalHeatwave, heatwaveMessage: finalHeatwaveMessage, hasIceRisk: finalIceRisk, iceRiskMessage: finalIceRiskMessage,
                     isManuallyOverridden };
        });
        setWeatherData(processedData);

    }, [rawWeatherData, simulateStorm, simulateHeatwave, simulateIceRisk, currentHeatwaveThresholdC, currentConsecutiveDays, currentIceTempThresholdC, manualOverrides]);


    const handleApplyDevThresholds = useCallback(() => {
        setCurrentWindThresholdMph(parseFloat(windInputRef.current?.value || String(DEFAULT_WIND_THRESHOLD_MPH)));
        setCurrentRainThresholdMmHr(parseFloat(rainInputRef.current?.value || String(DEFAULT_RAIN_THRESHOLD_MM_HR)));
        setCurrentHeatwaveThresholdC(parseFloat(heatwaveInputRef.current?.value || String(DEFAULT_HEATWAVE_THRESHOLD_C)));
        setCurrentConsecutiveDays(parseInt(consecutiveDaysInputRef.current?.value || String(DEFAULT_CONSECUTIVE_DAYS)));
        setCurrentIceTempThresholdC(parseFloat(iceTempInputRef.current?.value || String(DEFAULT_ICE_TEMP_THRESHOLD_C)));
        setCurrentIcyHumidityThreshold(parseInt(icyHumidityInputRef.current?.value || String(DEFAULT_ICY_HUMIDITY_THRESHOLD)));
        handleFetchWeatherData();
    }, [handleFetchWeatherData]);

    useEffect(() => {
        if (!isLoading) { saveDevThresholds(); }
    }, [currentWindThresholdMph, currentRainThresholdMmHr, currentHeatwaveThresholdC, currentConsecutiveDays, currentIceTempThresholdC, currentIcyHumidityThreshold, saveDevThresholds, isLoading]);

    const handleResetDevThresholds = useCallback(() => {
        if (windInputRef.current) windInputRef.current.value = DEFAULT_WIND_THRESHOLD_MPH.toFixed(2);
        if (rainInputRef.current) rainInputRef.current.value = DEFAULT_RAIN_THRESHOLD_MM_HR.toFixed(1);
        if (heatwaveInputRef.current) heatwaveInputRef.current.value = DEFAULT_HEATWAVE_THRESHOLD_C.toString();
        if (consecutiveDaysInputRef.current) consecutiveDaysInputRef.current.value = DEFAULT_CONSECUTIVE_DAYS.toString();
        if (iceTempInputRef.current) iceTempInputRef.current.value = DEFAULT_ICE_TEMP_THRESHOLD_C.toFixed(1);
        if (icyHumidityInputRef.current) icyHumidityInputRef.current.value = DEFAULT_ICY_HUMIDITY_THRESHOLD.toString();
        
        setCurrentWindThresholdMph(DEFAULT_WIND_THRESHOLD_MPH);
        setCurrentRainThresholdMmHr(DEFAULT_RAIN_THRESHOLD_MM_HR);
        setCurrentHeatwaveThresholdC(DEFAULT_HEATWAVE_THRESHOLD_C);
        setCurrentConsecutiveDays(DEFAULT_CONSECUTIVE_DAYS);
        setCurrentIceTempThresholdC(DEFAULT_ICE_TEMP_THRESHOLD_C);
        setCurrentIcyHumidityThreshold(DEFAULT_ICY_HUMIDITY_THRESHOLD);
        
        setSimulateStorm(false); setSimulateHeatwave(false); setSimulateIceRisk(false);
        setManualOverrides({}); 
        setSelectedCountryForOverride(Object.keys(UK_COUNTIES_BY_CATEGORY)[0] || '');
        setSelectedCountyForOverride('');
        handleFetchWeatherData(); 
    }, [handleFetchWeatherData]);

    const handleToggleManualOverride = (county: string, country: string) => {
        if (!county || !country) return;
        const key = `${county}-${country}`;
        setManualOverrides(prev => { const newOverrides = { ...prev }; if (newOverrides[key]) delete newOverrides[key]; else newOverrides[key] = true; return newOverrides; });
    };
    const handleClearAllManualOverrides = () => setManualOverrides({});

    useEffect(() => { 
        if (selectedCountryForOverride && UK_COUNTIES_BY_CATEGORY[selectedCountryForOverride as keyof typeof UK_COUNTIES_BY_CATEGORY]?.length > 0) {
            setSelectedCountyForOverride(UK_COUNTIES_BY_CATEGORY[selectedCountryForOverride as keyof typeof UK_COUNTIES_BY_CATEGORY][0]);
        } else { setSelectedCountyForOverride(''); }
    }, [selectedCountryForOverride]);
    
    const toggleCountyDetails = (countyName: string, countryName: string) => {
        setWeatherData(prevData => prevData.map(item => item.county === countyName && item.country === countryName ? { ...item, detailsExpanded: !item.detailsExpanded } : item));
    };

    const filteredWeatherData = weatherData
        .filter(item => { // Country Filter
            if (countryFilter === 'all') return true;
            return item.country === countryFilter;
        })
        .filter(item => // Search Term Filter
            item.county.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .filter(item => { // Show Only Warnings & Warning Type Filter
            if (!showOnlyWarnings) return true;
            if (!item.hasWarning) return false;

            switch (warningTypeFilter) {
                case 'official': return item.officialAlerts && item.officialAlerts.length > 0;
                case 'storm': return item.hasStormWarning;
                case 'heatwave': return item.hasHeatwave;
                case 'ice': return item.hasIceRisk;
                case 'all':
                default: return true; // Already confirmed item.hasWarning
            }
        });


    const groupedWeatherData = filteredWeatherData.reduce((acc, item) => {
        if (!acc[item.country]) acc[item.country] = [];
        acc[item.country].push(item);
        return acc;
    }, {} as Record<string, CountyWeatherData[]>);

    const colorSchemeClass = theme === 'light' ? '[color-scheme:light]' : '[color-scheme:dark]';
    const inputClasses = `mt-1 block w-full px-3 py-2 bg-crm-background dark:bg-crm-dm-background border border-crm-border dark:border-crm-dm-border rounded-md shadow-sm focus:outline-none focus:ring-crm-accent focus:border-crm-accent sm:text-sm transition-colors duration-300 ${colorSchemeClass}`;
    const labelClasses = "block text-sm font-medium text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300";
    const buttonClasses = "bg-gradient-to-r from-fuchsia-500 via-sky-400 to-violet-500 text-crm-button-text font-semibold py-2 px-4 rounded-lg hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-crm-accent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed";
    const cardClasses = "relative bg-crm-card dark:bg-crm-dm-card p-4 sm:p-6 rounded-xl shadow-lg dark:shadow-2xl transition-colors duration-300"; 
    const checkboxLabelClasses = "ml-2 text-sm text-crm-text-body dark:text-crm-dm-text-body transition-colors duration-300 cursor-pointer";

    // Developer Tools specific styles
    const devToolsSectionTitleClasses = "text-lg font-semibold text-crm-text-heading dark:text-crm-dm-text-heading mb-3 pb-2 border-b border-crm-border dark:border-crm-dm-border";
    
    const devThresholdItemLabelClasses = "text-sm font-medium text-crm-text-body dark:text-crm-dm-text-body mr-2 whitespace-nowrap";
    const devThresholdItemInputClasses = `px-2 py-1 flex-grow bg-crm-background dark:bg-crm-dm-background border border-crm-border dark:border-crm-dm-border rounded-md shadow-sm focus:outline-none focus:ring-crm-accent focus:border-crm-accent sm:text-sm transition-colors duration-300 ${colorSchemeClass}`;


    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl sm:text-3xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading">UK Weather Warning Predictor</h2>
                <button onClick={onClose} className="flex items-center text-crm-accent hover:underline text-sm font-medium" aria-label="Back to Hub">
                    <ArrowLeftIcon className="w-4 h-4 mr-1" /> Back to Hub
                </button>
            </div>

            {isDevToolsVisible && (
                <div className={`${cardClasses} space-y-6`}>
                     <button onClick={() => setIsDevToolsVisible(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 p-1.5 rounded-full text-crm-text-muted dark:text-crm-dm-text-muted hover:bg-crm-icon-bg dark:hover:bg-crm-dm-icon-bg focus:outline-none focus:ring-2 focus:ring-crm-accent" aria-label="Close developer tools">
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                    <h3 className="text-xl font-bold text-crm-text-heading dark:text-crm-dm-text-heading pr-10 mb-6">Developer Tools</h3>
                    
                    {/* Threshold Configuration Section */}
                    <div className="space-y-3">
                        <h4 className={devToolsSectionTitleClasses}>⚙️ Threshold Configuration</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3"> 
                            <div className="flex items-center"> 
                                <label htmlFor="devWindThreshold" className={devThresholdItemLabelClasses}>Wind (mph gust):</label>
                                <input type="number" id="devWindThreshold" ref={windInputRef} step="0.01" className={devThresholdItemInputClasses} defaultValue={currentWindThresholdMph.toFixed(2)} />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="devRainThreshold" className={devThresholdItemLabelClasses}>Rain (mm/hr):</label>
                                <input type="number" id="devRainThreshold" ref={rainInputRef} step="0.1" className={devThresholdItemInputClasses} defaultValue={currentRainThresholdMmHr.toFixed(1)} />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="devHeatwaveThreshold" className={devThresholdItemLabelClasses}>Heatwave (°C feels):</label>
                                <input type="number"id="devHeatwaveThreshold" ref={heatwaveInputRef} className={devThresholdItemInputClasses} defaultValue={currentHeatwaveThresholdC} />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="devConsecutiveDays" className={devThresholdItemLabelClasses}>Hot Days (consec.):</label> 
                                <input type="number" id="devConsecutiveDays" ref={consecutiveDaysInputRef} min="1" className={devThresholdItemInputClasses} defaultValue={currentConsecutiveDays} />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="devIceTempThreshold" className={devThresholdItemLabelClasses}>Ice Temp (°C):</label>
                                <input type="number" id="devIceTempThreshold" ref={iceTempInputRef} step="0.1" className={devThresholdItemInputClasses} defaultValue={currentIceTempThresholdC.toFixed(1)} />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="devIcyHumidityThreshold" className={devThresholdItemLabelClasses}>Ice Humidity (%):</label>
                                <input type="number" id="devIcyHumidityThreshold" ref={icyHumidityInputRef} min="0" max="100" className={devThresholdItemInputClasses} defaultValue={currentIcyHumidityThreshold} />
                            </div>
                        </div>
                    </div>

                    {/* Global Simulations Section */}
                     <div className="space-y-3 pt-4">
                        <h4 className={devToolsSectionTitleClasses}>✨ Global Simulations</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
                            {[ {id: 'simulateStormToggle', label: 'Simulate Storm (All Counties)', checked: simulateStorm, setter: setSimulateStorm},
                               {id: 'simulateHeatwaveToggle', label: 'Simulate Heatwave (All Counties)', checked: simulateHeatwave, setter: setSimulateHeatwave},
                               {id: 'simulateIceRiskToggle', label: 'Simulate Ice Risk (All Counties)', checked: simulateIceRisk, setter: setSimulateIceRisk}
                            ].map(sim => (
                                <div className="flex items-center" key={sim.id}>
                                    <input type="checkbox" id={sim.id} checked={sim.checked} onChange={(e: ChangeEvent<HTMLInputElement>) => sim.setter(e.target.checked)} className={`h-4 w-4 appearance-none rounded focus:ring-crm-accent mr-2 border border-crm-border bg-crm-background dark:border-crm-dm-border dark:bg-slate-700 checked:bg-crm-accent checked:border-crm-accent checked:[background-image:url("${CHECKMARK_SVG_DATA_URI}")] checked:bg-no-repeat checked:bg-center checked:[background-size:70%_70%]`} />
                                    <label htmlFor={sim.id} className={checkboxLabelClasses}>{sim.label}</label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Manual County Warnings Section */}
                    <div className="space-y-4 pt-4">
                        <h4 className={devToolsSectionTitleClasses}>📌 Manual County Warnings</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-3">
                            <div>
                                <label htmlFor="overrideCountrySelect" className={labelClasses}>Target Country</label>
                                <select id="overrideCountrySelect" value={selectedCountryForOverride} onChange={(e) => setSelectedCountryForOverride(e.target.value)} className={inputClasses}>
                                    {Object.keys(UK_COUNTIES_BY_CATEGORY).map(country => (<option key={country} value={country}>{country}</option>))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="overrideCountySelect" className={labelClasses}>Target County</label>
                                <select id="overrideCountySelect" value={selectedCountyForOverride} onChange={(e) => setSelectedCountyForOverride(e.target.value)} className={inputClasses} disabled={!selectedCountryForOverride || UK_COUNTIES_BY_CATEGORY[selectedCountryForOverride as keyof typeof UK_COUNTIES_BY_CATEGORY]?.length === 0}>
                                    {selectedCountryForOverride && UK_COUNTIES_BY_CATEGORY[selectedCountryForOverride as keyof typeof UK_COUNTIES_BY_CATEGORY]?.map(county => (<option key={county} value={county}>{county}</option>))}
                                </select>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                             <button 
                                onClick={() => handleToggleManualOverride(selectedCountyForOverride, selectedCountryForOverride)} 
                                disabled={!selectedCountyForOverride || !selectedCountryForOverride}
                                className={`w-full sm:w-auto text-sm px-4 py-2 rounded-md transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-crm-accent focus:ring-offset-2 ${manualOverrides[`${selectedCountyForOverride}-${selectedCountryForOverride}`] ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'} disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {manualOverrides[`${selectedCountyForOverride}-${selectedCountryForOverride}`] ? `Clear Manual Warning for ${selectedCountyForOverride || 'N/A'}` : `Set Manual Warning for ${selectedCountyForOverride || 'N/A'}`}
                            </button>
                            <button onClick={handleClearAllManualOverrides} className="w-full sm:w-auto text-sm text-crm-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed" disabled={Object.keys(manualOverrides).length === 0}>
                                Clear All Manual Warnings
                            </button>
                        </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="pt-6 border-t border-crm-border dark:border-crm-dm-border flex flex-col sm:flex-row gap-3">
                        <button 
                            onClick={handleApplyDevThresholds} 
                            className={`${buttonClasses} flex-grow text-sm`}
                        >
                            Apply Settings & Re-fetch Data
                        </button>
                        <button 
                            onClick={handleResetDevThresholds} 
                            className={`${buttonClasses} flex-grow text-sm bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 focus:ring-gray-400`}
                        >
                            Reset All Dev Settings to Defaults
                        </button>
                    </div>
                     <p className="text-xs text-crm-text-muted dark:text-crm-dm-text-muted pt-2 text-center">Toggle Developer Tools: Ctrl+Shift+F or right-click "Fetch Weather Data" button.</p>
                </div>
            )}

            <div className={`${cardClasses}`}>
                <button ref={fetchWeatherBtnRef} onClick={handleFetchWeatherData} disabled={isLoading} className={`${buttonClasses} w-full mb-4 py-2.5 text-base`}>
                    {isLoading ? 'Fetching Data...' : 'Fetch Weather Data'}
                </button>

                {!isLoading && rawWeatherData.length > 0 && ( 
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
                        {/* Item 1: Search County */}
                        <div>
                            <label htmlFor="countySearch" className={labelClasses}>Search County:</label>
                            <input type="text" id="countySearch" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputClasses.replace(colorSchemeClass, '')} placeholder="Enter county name..." />
                        </div>

                        {/* Item 2: Filter by Country */}
                        <div>
                            <label htmlFor="countryFilter" className={labelClasses}>Filter by Country:</label>
                            <select id="countryFilter" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className={inputClasses}>
                            <option value="all">All UK</option>
                            {Object.keys(UK_COUNTIES_BY_CATEGORY).map(countryName => (<option key={countryName} value={countryName}>{countryName}</option>))}
                            </select>
                        </div>

                        {/* Item 3: Show Only Warnings Checkbox */}
                        <div className="flex items-center pt-1"> {/* Adjusted for vertical alignment */}
                            <input type="checkbox" id="showWarningsToggle" checked={showOnlyWarnings} onChange={(e: ChangeEvent<HTMLInputElement>) => setShowOnlyWarnings(e.target.checked)} className={`h-4 w-4 appearance-none rounded focus:ring-crm-accent mr-2 border border-crm-border bg-crm-background dark:border-crm-dm-border dark:bg-slate-700 checked:bg-crm-accent checked:border-crm-accent checked:[background-image:url("${CHECKMARK_SVG_DATA_URI}")] checked:bg-no-repeat checked:bg-center checked:[background-size:70%_70%]`} />
                            <label htmlFor="showWarningsToggle" className={`${checkboxLabelClasses} self-center`}>Show only active warnings</label>
                        </div>

                        {/* Item 4: Filter by Warning Type (Conditionally Disabled) */}
                        <div className={!showOnlyWarnings ? 'opacity-60' : ''}>
                            <label htmlFor="warningTypeFilter" className={`${labelClasses} ${!showOnlyWarnings ? 'text-crm-text-muted dark:text-crm-dm-text-muted cursor-not-allowed' : ''}`}>
                            If warnings shown, filter by type:
                            </label>
                            <select 
                                id="warningTypeFilter" 
                                value={warningTypeFilter} 
                                onChange={e => setWarningTypeFilter(e.target.value as WarningTypeFilterValue)} 
                                className={inputClasses}
                                disabled={!showOnlyWarnings}
                                aria-label="Filter by warning type"
                            >
                                <option value="all">All Active Warning Types</option>
                                <option value="official">Official Alerts Only</option>
                                <option value="storm">Storm Predictions Only</option>
                                <option value="heatwave">Heatwave Predictions Only</option>
                                <option value="ice">Ice Risk Predictions Only</option>
                            </select>
                        </div>
                    </div>
                )}

                {fetchStatusMessage && (
                    <p className={`text-sm my-2 p-3 rounded-md ${fetchStatusMessage.includes('Error:') || fetchStatusMessage.includes('missing') ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' : fetchStatusMessage.includes('successful') ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'}`}>
                        {fetchStatusMessage}
                        {lastUpdated && ` (Last updated: ${lastUpdated.toLocaleTimeString()})`}
                    </p>
                )}
                
                {(!API_KEY) && !isLoading && (<p className="text-red-500 dark:text-red-400 font-semibold p-3 bg-red-100 dark:bg-red-800 rounded-md">API Key not configured.</p>)}
                {!isLoading && rawWeatherData.length > 0 && Object.keys(groupedWeatherData).length === 0 && (searchTerm || showOnlyWarnings || countryFilter !== 'all') && (<p className="text-crm-text-muted dark:text-crm-dm-text-muted py-4 text-center">No counties match the current filters.</p>)}

                {!isLoading && weatherData.length > 0 && Object.keys(groupedWeatherData).length > 0 && Object.keys(groupedWeatherData).map(country => (
                    <div key={country} className="mb-6">
                        <h3 className="text-xl font-semibold text-crm-text-heading dark:text-crm-dm-text-heading mb-2 border-b border-crm-border dark:border-crm-dm-border pb-1">{country}</h3>
                        <ul className="space-y-1">
                            {groupedWeatherData[country].map(item => (
                                <li key={`${item.country}-${item.county}`} className={`p-3 rounded-md transition-colors duration-200 ${ item.error ? 'bg-red-50 dark:bg-red-900/50 opacity-80' : item.hasWarning ? 'bg-amber-50 dark:bg-amber-800/30' : 'bg-crm-background dark:bg-crm-dm-background/50'}`}>
                                    <div className={`flex justify-between items-center ${item.hasWarning && !item.error ? 'cursor-pointer' : ''}`} onClick={() => item.hasWarning && !item.error && toggleCountyDetails(item.county, item.country)}>
                                        <div className="flex items-center space-x-2">
                                            {item.isManuallyOverridden && <span title="Manually Overridden" className="text-xs text-blue-600 dark:text-blue-400 mr-1 font-bold">(M)</span>}
                                            <span className="font-medium text-crm-text-body dark:text-crm-dm-text-body">{item.county}</span>
                                            {item.officialAlerts && item.officialAlerts.length > 0 && (<div className="relative group flex items-center"><span className="text-lg cursor-default">📢</span><div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs bg-crm-text-heading dark:bg-crm-dm-text-heading text-crm-background dark:text-crm-dm-background rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 invisible group-hover:visible z-20 whitespace-nowrap">Official Alert: {item.officialAlerts[0].event}</div></div>)}
                                            {item.hasHeatwave && (<div className="relative group flex items-center"><span className="text-lg cursor-default">🔥</span><div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs bg-crm-text-heading dark:bg-crm-dm-text-heading text-crm-background dark:text-crm-dm-background rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 invisible group-hover:visible z-20 whitespace-nowrap">{item.heatwaveMessage}</div></div>)}
                                            {item.showsStormIcon && (<div className="relative group flex items-center"><span className="text-lg cursor-default">⛈️</span><div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs bg-crm-text-heading dark:bg-crm-dm-text-heading text-crm-background dark:text-crm-dm-background rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 invisible group-hover:visible z-20 whitespace-nowrap">{item.stormMessage.split('.')[0]}</div></div>)}
                                            {item.hasIceRisk && (<div className="relative group flex items-center"><span className="text-lg cursor-default">❄️</span><div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-max max-w-xs p-2 text-xs bg-crm-text-heading dark:bg-crm-dm-text-heading text-crm-background dark:text-crm-dm-background rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 invisible group-hover:visible z-20 whitespace-nowrap">{item.iceRiskMessage}</div></div>)}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {item.error ? (<span className="text-xs px-2 py-0.5 rounded-full bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100" title={item.errorMessage || 'Error'}>ERROR</span>)
                                                       : item.hasWarning ? (<span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                                            item.isManuallyOverridden ? 'bg-blue-500 text-white' :
                                                            (item.officialAlerts && item.officialAlerts.length > 0) ?
                                                                (() => {
                                                                    const eventText = item.officialAlerts[0].event?.toLowerCase() || '';
                                                                    if (eventText.includes('red')) return 'bg-red-600 text-white';
                                                                    if (eventText.includes('yellow')) return 'bg-yellow-400 text-yellow-900';
                                                                    return 'bg-red-500 text-white'; // Default for other official alerts (e.g., Amber)
                                                                })() :
                                                            item.hasStormWarning ? 'bg-orange-500 text-white' :
                                                            item.hasIceRisk ? 'bg-sky-500 text-white' :
                                                            item.hasHeatwave ? 'bg-amber-500 text-white' :
                                                            item.isPredictedThresholdWarning ? 'bg-amber-500 text-white' :
                                                            'bg-amber-500 text-white' // Fallback if hasWarning is true but no specific type matches
                                                          }`}>YES</span>)
                                                       : (<span className="text-xs px-2 py-0.5 rounded-full bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100 font-semibold">NO</span>)}
                                            {item.hasWarning && !item.error && (<span className={`transform transition-transform duration-200 ${item.detailsExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span>)}
                                        </div>
                                    </div>
                                     {item.detailsExpanded && item.hasWarning && !item.error && (
                                        <div className="mt-2 pl-4 border-l-2 border-crm-accent dark:border-crm-accent space-y-3 text-xs text-crm-text-muted dark:text-crm-dm-text-muted">
                                            {item.isManuallyOverridden && (<p className="font-semibold text-blue-600 dark:text-blue-400">Manually set warning active (Dev Tools)</p>)}
                                            {item.officialAlerts && item.officialAlerts.length > 0 && (<div className="pt-1"><h4 className="font-semibold text-sm mb-1 text-red-600 dark:text-red-400">Official Alerts:</h4>{item.officialAlerts.map((alert, idx) => (<div key={`official-${idx}`} className="mb-2 p-2 bg-red-50 dark:bg-red-900/70 rounded text-crm-text-body dark:text-crm-dm-text-body"><p className="font-bold">{alert.event}</p>{alert.headline && <p><strong>Headline:</strong> {alert.headline}</p>}{alert.severity && <p><strong>Severity:</strong> {alert.severity}</p>}<p><strong>Effective:</strong> {formatDateSafe(alert.effective)}</p><p><strong>Expires:</strong> {formatDateSafe(alert.expires)}</p><p className="mt-1 whitespace-pre-wrap">{alert.desc}</p>{alert.instruction && <p className="mt-1"><strong>Instruction:</strong> {alert.instruction}</p>}</div>))}</div>)}
                                            {item.hasStormWarning && item.stormMessage && (<div className="pt-1"><h4 className="font-semibold text-sm mb-1 text-orange-600 dark:text-orange-400">Storm Prediction:</h4><p>{item.stormMessage}</p></div>)}
                                            {item.hasIceRisk && item.iceRiskMessage && (<div className="pt-1"><h4 className="font-semibold text-sm mb-1 text-sky-600 dark:text-sky-400">Ice Risk Prediction:</h4><p>{item.iceRiskMessage}</p></div>)}
                                            {item.isPredictedThresholdWarning && item.reason && item.reason.length > 0 && (!item.hasStormWarning || !item.stormMessage.toLowerCase().includes('wind & rain')) && (<div className="pt-1"><h4 className="font-semibold text-sm mb-1 text-amber-600 dark:text-amber-400">Predicted Conditions (Thresholds):</h4>{item.reason.map((reasonDetail, idx) => (<p key={`predicted-${idx}`}>{reasonDetail}</p>))}</div>)}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default UkWeatherPredictor;