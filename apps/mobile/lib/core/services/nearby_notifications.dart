import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:workmanager/workmanager.dart';

const nearbyTaskName = 'onepixel-nearby-event-check';

class NearbyNotifications {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> initialize({bool requestPermission = false}) async {
    if (!_initialized) {
      await _plugin.initialize(
        settings: const InitializationSettings(
          android: AndroidInitializationSettings('ic_stat_onepixel'),
        ),
      );
      _initialized = true;
    }
    if (requestPermission) {
      await _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.requestNotificationsPermission();
    }
  }

  static Future<void> notifyOnce(NearbyEvent event) async {
    final preferences = await SharedPreferences.getInstance();
    if (preferences.getString('onepixel.last-nearby-event') == event.id) return;
    await initialize();
    await _plugin.show(
      id: event.id.hashCode & 0x7fffffff,
      title: '${event.title} è vicino a te',
      body: 'Apri onePixel e scansiona il QR del settore o del posto.',
      notificationDetails: const NotificationDetails(
        android: AndroidNotificationDetails(
          'onepixel-nearby-events',
          'Eventi onePixel nelle vicinanze',
          channelDescription:
              'Avvisa quando un evento onePixel attivo è vicino, senza salvare la posizione.',
          importance: Importance.high,
          priority: Priority.high,
          category: AndroidNotificationCategory.event,
        ),
      ),
      payload: event.id,
    );
    await preferences.setString('onepixel.last-nearby-event', event.id);
  }
}

@pragma('vm:entry-point')
void nearbyCallbackDispatcher() {
  Workmanager().executeTask((task, inputData) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    if (task != nearbyTaskName) return true;
    try {
      final permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return true;
      }
      final position = await Geolocator.getLastKnownPosition();
      if (position == null ||
          DateTime.now().difference(position.timestamp).inHours > 6) {
        return true;
      }
      final api = OnePixelApiClient(baseUrl: inputData?['apiUrl'] as String?);
      final events = await api.nearby(
        latitude: position.latitude,
        longitude: position.longitude,
      );
      api.close();
      if (events.isNotEmpty) await NearbyNotifications.notifyOnce(events.first);
      return true;
    } catch (_) {
      return false;
    }
  });
}

Future<void> scheduleNearbyChecks(String apiUrl) async {
  await Workmanager().initialize(nearbyCallbackDispatcher);
  await Workmanager().registerPeriodicTask(
    'onepixel-nearby-periodic-v1',
    nearbyTaskName,
    frequency: const Duration(minutes: 15),
    inputData: {'apiUrl': apiUrl},
    constraints: Constraints(networkType: NetworkType.connected),
    existingWorkPolicy: ExistingPeriodicWorkPolicy.update,
  );
}
