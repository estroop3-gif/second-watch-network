"""
Weather service for fetching forecasts from Open-Meteo API.
Free API, no key required.
"""
import httpx
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
from functools import lru_cache


# WMO Weather interpretation codes
# https://open-meteo.com/en/docs
WMO_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
}


def get_weather_condition(code: int) -> str:
    """Convert WMO weather code to human-readable condition."""
    return WMO_WEATHER_CODES.get(code, "Unknown")


def get_wind_direction(degrees: float) -> str:
    """Convert wind degrees to cardinal direction."""
    directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    index = round(degrees / 22.5) % 16
    return directions[index]


async def fetch_weather_forecast(
    latitude: float,
    longitude: float,
    date: str,  # YYYY-MM-DD format
    include_hourly: bool = True
) -> Optional[Dict[str, Any]]:
    """
    Fetch weather forecast from Open-Meteo API.

    Args:
        latitude: Location latitude
        longitude: Location longitude
        date: Target date in YYYY-MM-DD format
        include_hourly: Whether to include hourly forecast

    Returns:
        Weather data dict or None if fetch fails
    """
    base_url = "https://api.open-meteo.com/v1/forecast"

    # Build parameters
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max,winddirection_10m_dominant,relative_humidity_2m_max",
        "temperature_unit": "fahrenheit",
        "windspeed_unit": "mph",
        "timezone": "auto",  # Auto-detect from coordinates
        "start_date": date,
        "end_date": date,
    }

    if include_hourly:
        params["hourly"] = "temperature_2m,weathercode,precipitation_probability"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(base_url, params=params)
            response.raise_for_status()
            data = response.json()

            # Parse the response
            daily = data.get("daily", {})
            hourly = data.get("hourly", {})

            # Get the first (and only) day's data
            if not daily.get("time"):
                return None

            # Parse sunrise/sunset to HH:MM format
            sunrise_raw = daily.get("sunrise", [None])[0]
            sunset_raw = daily.get("sunset", [None])[0]

            sunrise_time = None
            sunset_time = None
            if sunrise_raw:
                try:
                    sunrise_dt = datetime.fromisoformat(sunrise_raw)
                    sunrise_time = sunrise_dt.strftime("%H:%M")
                except:
                    pass
            if sunset_raw:
                try:
                    sunset_dt = datetime.fromisoformat(sunset_raw)
                    sunset_time = sunset_dt.strftime("%H:%M")
                except:
                    pass

            # Get timezone info
            timezone = data.get("timezone", "UTC")
            utc_offset = data.get("utc_offset_seconds", 0)
            hours_offset = utc_offset // 3600
            mins_offset = (abs(utc_offset) % 3600) // 60
            sign = "+" if hours_offset >= 0 else "-"
            timezone_offset = f"{sign}{abs(hours_offset):02d}:{mins_offset:02d}"

            # Build forecast object
            weather_code = daily.get("weathercode", [0])[0] or 0
            wind_degrees = daily.get("winddirection_10m_dominant", [0])[0] or 0

            result = {
                "timezone": timezone,
                "timezone_offset": timezone_offset,
                "date": date,
                "sunrise": sunrise_time,
                "sunset": sunset_time,
                "forecast": {
                    "condition": get_weather_condition(weather_code),
                    "weather_code": weather_code,
                    "high_temp_f": daily.get("temperature_2m_max", [None])[0],
                    "low_temp_f": daily.get("temperature_2m_min", [None])[0],
                    "precipitation_chance": daily.get("precipitation_probability_max", [0])[0] or 0,
                    "humidity": daily.get("relative_humidity_2m_max", [None])[0],
                    "wind_mph": daily.get("windspeed_10m_max", [None])[0],
                    "wind_direction": get_wind_direction(wind_degrees),
                    "wind_degrees": wind_degrees,
                },
            }

            # Add hourly data if requested
            if include_hourly and hourly.get("time"):
                hourly_data = []
                times = hourly.get("time", [])
                temps = hourly.get("temperature_2m", [])
                codes = hourly.get("weathercode", [])
                precip = hourly.get("precipitation_probability", [])

                for i, time_str in enumerate(times):
                    try:
                        dt = datetime.fromisoformat(time_str)
                        hourly_data.append({
                            "time": dt.strftime("%H:%M"),
                            "temp_f": temps[i] if i < len(temps) else None,
                            "condition": get_weather_condition(codes[i] if i < len(codes) else 0),
                            "precipitation_chance": precip[i] if i < len(precip) else 0,
                        })
                    except:
                        continue

                result["hourly"] = hourly_data

            return result

    except httpx.HTTPError as e:
        print(f"Weather API error: {e}")
        return None
    except Exception as e:
        print(f"Weather service error: {e}")
        return None


def format_weather_forecast_text(weather_data: Dict[str, Any]) -> str:
    """
    Format weather data into human-readable text for call sheet.

    Args:
        weather_data: Weather data dict from fetch_weather_forecast

    Returns:
        Formatted weather string
    """
    if not weather_data:
        return ""

    forecast = weather_data.get("forecast", {})

    parts = []

    # Condition and temps
    condition = forecast.get("condition", "")
    high = forecast.get("high_temp_f")
    low = forecast.get("low_temp_f")

    if condition:
        parts.append(condition)

    if high is not None and low is not None:
        parts.append(f"High {high:.0f}F / Low {low:.0f}F")
    elif high is not None:
        parts.append(f"High {high:.0f}F")

    # Precipitation
    precip = forecast.get("precipitation_chance", 0)
    if precip and precip > 0:
        parts.append(f"{precip}% chance of precipitation")

    # Wind
    wind_mph = forecast.get("wind_mph")
    wind_dir = forecast.get("wind_direction")
    if wind_mph and wind_mph > 5:  # Only mention if notable
        if wind_dir:
            parts.append(f"Wind {wind_mph:.0f} mph {wind_dir}")
        else:
            parts.append(f"Wind {wind_mph:.0f} mph")

    # Humidity
    humidity = forecast.get("humidity")
    if humidity and humidity > 60:  # Only mention if high
        parts.append(f"{humidity}% humidity")

    return ". ".join(parts) + "." if parts else ""


def get_timezone_abbreviation(timezone: str, date: str) -> str:
    """
    Get timezone abbreviation for display.

    Args:
        timezone: IANA timezone string (e.g., "America/Los_Angeles")
        date: Date string for determining DST

    Returns:
        Abbreviation like "PST" or "PDT"
    """
    try:
        import pytz
        tz = pytz.timezone(timezone)
        dt = datetime.strptime(date, "%Y-%m-%d")
        localized = tz.localize(dt)
        return localized.strftime("%Z")
    except:
        # Fallback: extract from timezone name
        parts = timezone.split("/")
        if len(parts) > 1:
            return parts[-1][:3].upper()
        return timezone[:3].upper()
