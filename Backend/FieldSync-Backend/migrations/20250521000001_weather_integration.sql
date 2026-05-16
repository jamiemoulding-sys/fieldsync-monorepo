-- Weather Integration Schema
-- Adds weather data storage with proper validation and constraints

-- Add weather columns to shifts table
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS weather_data JSONB;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS weather_fetched_at TIMESTAMP WITH TIME ZONE;

-- Add weather data validation constraints
ALTER TABLE shifts ADD CONSTRAINT shifts_weather_data_valid 
CHECK (
  weather_data IS NULL OR (
    jsonb_typeof(weather_data) = 'object' AND
    (weather_data->>'temperature') IS NOT NULL AND
    (weather_data->>'humidity') IS NOT NULL AND
    (weather_data->>'condition') IS NOT NULL
  )
);

-- Add weather data range constraints
ALTER TABLE shifts ADD CONSTRAINT shifts_weather_temp_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'temperature')::NUMERIC BETWEEN -100 AND 150
);

ALTER TABLE shifts ADD CONSTRAINT shifts_weather_humidity_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'humidity')::NUMERIC BETWEEN 0 AND 100
);

ALTER TABLE shifts ADD CONSTRAINT shifts_weather_condition_length 
CHECK (
  weather_data IS NULL OR
  LENGTH(TRIM(weather_data->>'condition')) BETWEEN 1 AND 50
);

-- Add optional weather fields with validation
ALTER TABLE shifts ADD CONSTRAINT shifts_weather_wind_speed_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'wind_speed')::NUMERIC >= 0
);

ALTER TABLE shifts ADD CONSTRAINT shifts_weather_wind_direction_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'wind_direction')::NUMERIC BETWEEN 0 AND 360
);

ALTER TABLE shifts ADD CONSTRAINT shifts_weather_visibility_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'visibility')::NUMERIC >= 0
);

ALTER TABLE shifts ADD CONSTRAINT shifts_weather_cloud_cover_range 
CHECK (
  weather_data IS NULL OR
  (weather_data->>'cloud_cover')::NUMERIC BETWEEN 0 AND 100
);

-- Add indexes for weather queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_weather_fetched_at 
ON shifts(weather_fetched_at DESC) WHERE weather_fetched_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_weather_data 
ON shifts USING GIN(weather_data) WHERE weather_data IS NOT NULL;

-- Create weather cache table for performance
CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lat_lng_key VARCHAR(20) NOT NULL, -- "lat,lng" rounded to 3 decimals
  weather_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '10 minutes'),
  
  -- Unique constraint for location
  UNIQUE(lat_lng_key)
);

-- Add indexes for weather cache
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_cache_lat_lng 
ON weather_cache(lat_lng_key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_cache_expires_at 
ON weather_cache(expires_at);

-- Add function to clean up expired weather cache
CREATE OR REPLACE FUNCTION cleanup_weather_cache()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM weather_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add function to get cached weather
CREATE OR REPLACE FUNCTION get_cached_weather(p_lat NUMERIC, p_lng NUMERIC)
RETURNS JSONB AS $$
DECLARE
    v_lat_lng_key VARCHAR(20);
    v_cached_weather JSONB;
BEGIN
    -- Generate cache key (rounded to 3 decimal places)
    v_lat_lng_key := ROUND(p.lat_lng_key::NUMERIC, 3)::TEXT || ',' || ROUND(p.lng::NUMERIC, 3)::TEXT;
    
    -- Get cached weather
    SELECT weather_data INTO v_cached_weather
    FROM weather_cache
    WHERE lat_lng_key = v_lat_lng_key AND expires_at > NOW();
    
    RETURN COALESCE(v_cached_weather, NULL);
END;
$$ LANGUAGE plpgsql;

-- Add function to cache weather data
CREATE OR REPLACE FUNCTION cache_weather_data(p_lat NUMERIC, p_lng NUMERIC, p_weather_data JSONB)
RETURNS VOID AS $$
DECLARE
    v_lat_lng_key VARCHAR(20);
BEGIN
    -- Generate cache key (rounded to 3 decimal places)
    v_lat_lng_key := ROUND(p.lat_lng_key::NUMERIC, 3)::TEXT || ',' || ROUND(p.lng::NUMERIC, 3)::TEXT;
    
    -- Insert or update cache
    INSERT INTO weather_cache (lat_lng_key, weather_data, expires_at)
    VALUES (
      v_lat_lng_key,
      p_weather_data,
      NOW() + INTERVAL '10 minutes'
    )
    ON CONFLICT (lat_lng_key) 
    DO UPDATE SET 
      weather_data = EXCLUDED.weather_data,
      expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- Add function to validate weather data
CREATE OR REPLACE FUNCTION validate_weather_data(p_weather_data JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_temperature NUMERIC;
    v_humidity NUMERIC;
    v_condition TEXT;
BEGIN
    -- Check if weather data is valid JSON object
    IF p_weather_data IS NULL OR jsonb_typeof(p_weather_data) != 'object' THEN
        RETURN FALSE;
    END IF;
    
    -- Extract required fields
    v_temperature := (p_weather_data->>'temperature')::NUMERIC;
    v_humidity := (p_weather_data->>'humidity')::NUMERIC;
    v_condition := TRIM(p_weather_data->>'condition');
    
    -- Validate temperature
    IF v_temperature IS NULL OR v_temperature < -100 OR v_temperature > 150 THEN
        RETURN FALSE;
    END IF;
    
    -- Validate humidity
    IF v_humidity IS NULL OR v_humidity < 0 OR v_humidity > 100 THEN
        RETURN FALSE;
    END IF;
    
    -- Validate condition
    IF v_condition IS NULL OR LENGTH(v_condition) = 0 OR LENGTH(v_condition) > 50 THEN
        RETURN FALSE;
    END IF;
    
    -- Validate optional fields
    IF (p_weather_data->>'wind_speed')::NUMERIC < 0 THEN
        RETURN FALSE;
    END IF;
    
    IF (p_weather_data->>'wind_direction')::NUMERIC < 0 OR (p_weather_data->>'wind_direction')::NUMERIC > 360 THEN
        RETURN FALSE;
    END IF;
    
    IF (p_weather_data->>'visibility')::NUMERIC < 0 THEN
        RETURN FALSE;
    END IF;
    
    IF (p_weather_data->>'cloud_cover')::NUMERIC < 0 OR (p_weather_data->>'cloud_cover')::NUMERIC > 100 THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for weather data validation
CREATE OR REPLACE FUNCTION validate_shift_weather_data()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate weather data if present
    IF NEW.weather_data IS NOT NULL THEN
        IF NOT validate_weather_data(NEW.weather_data) THEN
            RAISE EXCEPTION 'Invalid weather data: temperature, humidity, and condition are required and must be within valid ranges';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for weather data validation
DROP TRIGGER IF EXISTS validate_shift_weather_trigger ON shifts;
CREATE TRIGGER validate_shift_weather_trigger
  BEFORE INSERT OR UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION validate_shift_weather_data();

-- Create view for weather statistics
CREATE OR REPLACE VIEW weather_statistics AS
SELECT 
    DATE_TRUNC('day', weather_fetched_at) as date,
    COUNT(*) as shift_count,
    AVG((weather_data->>'temperature')::NUMERIC) as avg_temperature,
    MIN((weather_data->>'temperature')::NUMERIC) as min_temperature,
    MAX((weather_data->>'temperature')::NUMERIC) as max_temperature,
    AVG((weather_data->>'humidity')::NUMERIC) as avg_humidity,
    MIN((weather_data->>'humidity')::NUMERIC) as min_humidity,
    MAX((weather_data->>'humidity')::NUMERIC) as max_humidity,
    MODE() WITHIN GROUP (ORDER BY weather_data->>'condition') as most_common_condition
FROM shifts
WHERE weather_data IS NOT NULL
    AND weather_fetched_at IS NOT NULL
GROUP BY DATE_TRUNC('day', weather_fetched_at)
ORDER BY date DESC;

-- Add index for weather statistics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shifts_weather_date 
ON shifts(DATE_TRUNC('day', weather_fetched_at)) 
WHERE weather_data IS NOT NULL;

-- Create function to get weather alerts
CREATE OR REPLACE FUNCTION get_weather_alerts(p_company_id UUID, p_hours INTEGER DEFAULT 24)
RETURNS JSONB AS $$
DECLARE
    v_alerts JSONB := '[]'::jsonb;
    v_alert_count INTEGER := 0;
BEGIN
    -- Check for extreme temperature shifts
    WITH temp_shifts AS (
        SELECT 
            s.id,
            s.user_id,
            s.clock_in_time,
            (s.weather_data->>'temperature')::NUMERIC as clock_in_temp,
            (s.weather_data->>'temperature')::NUMERIC as clock_out_temp
        FROM shifts s
        WHERE s.company_id = p_company_id
            AND s.weather_data IS NOT NULL
            AND s.clock_in_time > NOW() - INTERVAL '1 day'
            AND s.clock_out_time IS NOT NULL
    )
    SELECT jsonb_build_object(
        'type', 'extreme_temperature_shift',
        'count', COUNT(*),
        'description', 'Shifts with temperature changes > 20°C',
        'shifts', ARRAY_AGG(id)
    ) INTO v_alert
    FROM temp_shifts
    WHERE ABS(clock_in_temp - clock_out_temp) > 20;
    
    IF v_alert.count > 0 THEN
        v_alerts := v_alerts || v_alert;
        v_alert_count := v_alert_count + 1;
    END IF;
    
    -- Check for severe weather conditions
    SELECT jsonb_build_object(
        'type', 'severe_weather',
        'count', COUNT(*),
        'description', 'Shifts during severe weather conditions',
        'conditions', ARRAY_AGG(DISTINCT weather_data->>'condition')
    ) INTO v_alert
    FROM shifts
    WHERE company_id = p_company_id
        AND weather_data IS NOT NULL
        AND clock_in_time > NOW() - INTERVAL '1 day'
        AND (
            weather_data->>'condition' ILIKE '%storm%' OR
            weather_data->>'condition' ILIKE '%rain%' OR
            weather_data->>'condition' ILIKE '%snow%' OR
            weather_data->>'condition' ILIKE '%thunder%'
        );
    
    IF v_alert.count > 0 THEN
        v_alerts := v_alerts || v_alert;
        v_alert_count := v_alert_count + 1;
    END IF;
    
    RETURN jsonb_build_object(
        'alerts', v_alerts,
        'alert_count', v_alert_count,
        'period_hours', p_hours,
        'generated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON weather_cache TO authenticated_users;
GRANT SELECT ON weather_statistics TO authenticated_users;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION cleanup_weather_cache() TO authenticated_users;
GRANT EXECUTE ON FUNCTION get_cached_weather(NUMERIC, NUMERIC) TO authenticated_users;
GRANT EXECUTE ON FUNCTION cache_weather_data(NUMERIC, NUMERIC, JSONB) TO authenticated_users;
GRANT EXECUTE ON FUNCTION validate_weather_data(JSONB) TO authenticated_users;
GRANT EXECUTE ON FUNCTION validate_shift_weather_data() TO authenticated_users;
GRANT EXECUTE ON FUNCTION get_weather_alerts(UUID, INTEGER) TO authenticated_users;

-- Comments
COMMENT ON TABLE weather_cache IS 'Cache for weather data to reduce API calls';
COMMENT ON VIEW weather_statistics IS 'Daily weather statistics for shifts';
COMMENT ON FUNCTION cleanup_weather_cache() IS 'Clean up expired weather cache entries';
COMMENT ON FUNCTION get_cached_weather(NUMERIC, NUMERIC) IS 'Get cached weather data';
COMMENT ON FUNCTION cache_weather_data(NUMERIC, NUMERIC, JSONB) IS 'Cache weather data';
COMMENT ON FUNCTION validate_weather_data(JSONB) IS 'Validate weather data format and ranges';
COMMENT ON FUNCTION validate_shift_weather_data() IS 'Trigger to validate weather data in shifts';
COMMENT ON FUNCTION get_weather_alerts(UUID, INTEGER) IS 'Get weather-related alerts for shifts';

-- Schedule cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-weather-cache', '*/5 * * * *', 'SELECT cleanup_weather_cache();');
