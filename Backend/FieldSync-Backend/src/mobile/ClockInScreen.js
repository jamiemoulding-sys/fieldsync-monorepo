/**
 * Clock-In Screen
 * 
 * Simple, focused clock-in screen with minimal complexity.
 * Server-authoritative with graceful error handling.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useAttendance } from './AttendanceContext';

const ClockInScreen = ({ navigation }) => {
  const { state, actions } = useAttendance();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [gpsStatus, setGpsStatus] = useState(null);

  useEffect(() => {
    // Check GPS status on mount
    checkGPSStatus();
  }, []);

  const checkGPSStatus = async () => {
    try {
      const status = await gpsCapture.getStatus();
      setGpsStatus(status);
    } catch (error) {
      setGpsStatus({ available: false, error: error.message });
    }
  };

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
  };

  const handleClockIn = async () => {
    if (!selectedLocation) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    if (!gpsStatus?.available) {
      Alert.alert('GPS Error', 'GPS is not available. Please enable GPS and try again.');
      return;
    }

    try {
      const result = await actions.clockIn(selectedLocation.id);
      
      if (result.success) {
        if (result.queued) {
          Alert.alert(
            'Clock-In Queued',
            'Your clock-in has been queued and will be processed when connection is available.',
            [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
          );
        } else {
          Alert.alert(
            'Success',
            'Clock-in successful!',
            [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
          );
        }
      } else {
        Alert.alert('Error', result.error || 'Clock-in failed');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderLocationItem = (location) => (
    <TouchableOpacity
      key={location.id}
      style={[
        styles.locationItem,
        selectedLocation?.id === location.id && styles.selectedLocationItem
      ]}
      onPress={() => handleLocationSelect(location)}
    >
      <Text style={styles.locationName}>{location.name}</Text>
      <Text style={styles.locationAddress}>{location.address}</Text>
      {location.radius && (
        <Text style={styles.locationRadius}>Radius: {location.radius}m</Text>
      )}
    </TouchableOpacity>
  );

  const renderGPSStatus = () => {
    if (!gpsStatus) {
      return <Text style={styles.statusText}>Checking GPS...</Text>;
    }

    if (!gpsStatus.available) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.errorText}>GPS Not Available</Text>
          <Text style={styles.errorSubtext}>{gpsStatus.error}</Text>
        </View>
      );
    }

    if (!gpsStatus.hasCoordinates) {
      return (
        <View style={styles.statusContainer}>
          <Text style={styles.warningText}>GPS Acquiring...</Text>
          <Text style={styles.warningSubtext}>Waiting for GPS signal</Text>
        </View>
      );
    }

    return (
      <View style={styles.statusContainer}>
        <Text style={styles.successText}>GPS Ready</Text>
        <Text style={styles.successSubtext}>
          Accuracy: {gpsStatus.accuracy ? `${Math.round(gpsStatus.accuracy)}m` : 'Unknown'}
        </Text>
      </View>
    );
  };

  if (state.loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Clock In</Text>
        {state.activeShift && (
          <Text style={styles.warningText}>
            You already have an active shift
          </Text>
        )}
      </View>

      <View style={styles.statusSection}>
        {renderGPSStatus()}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Location</Text>
        <ScrollView style={styles.locationList}>
          {state.locations.map(renderLocationItem)}
        </ScrollView>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[
            styles.clockInButton,
            (!selectedLocation || !gpsStatus?.available) && styles.disabledButton
          ]}
          onPress={handleClockIn}
          disabled={!selectedLocation || !gpsStatus?.available || state.loading}
        >
          {state.loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Clock In</Text>
          )}
        </TouchableOpacity>
      </View>

      {state.queueStatus.size > 0 && (
        <View style={styles.queueStatus}>
          <Text style={styles.queueText}>
            {state.queueStatus.size} items in queue
          </Text>
          {state.queueStatus.processing && (
            <Text style={styles.processingText}>Processing...</Text>
          )}
        </View>
      )}

      {state.error && (
        <View style={styles.errorSection}>
          <Text style={styles.errorText}>{state.error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: '#ff9800',
    textAlign: 'center',
    marginTop: 8,
  },
  statusSection: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusContainer: {
    alignItems: 'center',
  },
  successText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  successSubtext: {
    fontSize: 14,
    color: '#666',
  },
  warningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ff9800',
    marginBottom: 4,
  },
  warningSubtext: {
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f44336',
    marginBottom: 4,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    paddingHorizontal: 15,
    paddingTop: 15,
  },
  locationList: {
    maxHeight: 300,
  },
  locationItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectedLocationItem: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  locationName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  locationRadius: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 20,
  },
  clockInButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  queueStatus: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    alignItems: 'center',
  },
  queueText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 4,
  },
  processingText: {
    fontSize: 12,
    color: '#856404',
    fontStyle: 'italic',
  },
  errorSection: {
    margin: 20,
    padding: 15,
    backgroundColor: '#f8d7da',
    borderRadius: 8,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
};

export default ClockInScreen;
