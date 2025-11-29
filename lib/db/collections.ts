// MongoDB collection names and indexes
export const COLLECTIONS = {
  ZONES: 'zones',
  SENSORS: 'sensors',
  SENSOR_DATA: 'sensor_data',
  SENSOR_RULES: 'sensor_rules',
  PREDICTIONS: 'predictions',
};

// Initialize database indexes
export async function initializeIndexes(db: any) {
  try {
    // Zones indexes
    await db.collection(COLLECTIONS.ZONES).createIndex({ type: 1 });
    await db.collection(COLLECTIONS.ZONES).createIndex({ createdAt: -1 });
    
    // Sensors indexes
    await db.collection(COLLECTIONS.SENSORS).createIndex({ id: 1 }, { unique: true });
    
    // Sensor data indexes
    await db.collection(COLLECTIONS.SENSOR_DATA).createIndex({ sensorId: 1, timestamp: -1 });
    await db.collection(COLLECTIONS.SENSOR_DATA).createIndex({ timestamp: -1 });
    
    // Sensor rules indexes
    await db.collection(COLLECTIONS.SENSOR_RULES).createIndex({ id: 1 }, { unique: true });
    await db.collection(COLLECTIONS.SENSOR_RULES).createIndex({ enabled: 1 });
    
    // Predictions indexes
    await db.collection(COLLECTIONS.PREDICTIONS).createIndex({ type: 1, timestamp: -1 });
    await db.collection(COLLECTIONS.PREDICTIONS).createIndex({ expiresAt: 1 });
    
    console.log('MongoDB indexes initialized');
  } catch (error) {
    console.error('Error initializing indexes:', error);
  }
}
