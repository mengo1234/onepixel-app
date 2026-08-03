import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:onepixel/core/models/event_models.dart';

class OnePixelApiException implements Exception {
  const OnePixelApiException(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => '$code: $message';
}

class ParticipantAuthResult {
  const ParticipantAuthResult({required this.token, required this.profile});
  final String token;
  final ParticipantProfile profile;
}

class OnePixelApiClient {
  OnePixelApiClient({String? baseUrl, http.Client? client})
    : baseUrl =
          (baseUrl ??
                  const String.fromEnvironment(
                    'ONEPIXEL_API_URL',
                    defaultValue: 'https://onepixel-control-plane.vercel.app',
                  ))
              .replaceAll(RegExp(r'/$'), ''),
      _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<List<NearbyEvent>> nearby({
    required double latitude,
    required double longitude,
    int radiusM = 10000,
  }) async {
    final uri = Uri.parse('$baseUrl/v1/public/events/nearby').replace(
      queryParameters: {
        'lat': '$latitude',
        'lng': '$longitude',
        'radiusM': '$radiusM',
      },
    );
    final response = await _client.get(uri).timeout(const Duration(seconds: 8));
    return (_decode(response) as List)
        .map(
          (value) =>
              NearbyEvent.fromJson((value as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  Future<void> registerInstallation({
    required String installationId,
    required String locale,
    required bool notificationsEnabled,
    required bool locationEnabled,
    String? participantToken,
    String? pushToken,
  }) async {
    final response = await _client
        .put(
          Uri.parse('$baseUrl/v1/public/installations'),
          headers: _headers(participantToken),
          body: jsonEncode({
            'installationId': installationId,
            'pushToken': pushToken,
            'locale': locale,
            'notificationsEnabled': notificationsEnabled,
            'locationEnabled': locationEnabled,
          }),
        )
        .timeout(const Duration(seconds: 8));
    _decode(response);
  }

  Future<List<NearbyEvent>> refreshNearbyInstallation({
    required String installationId,
    required double latitude,
    required double longitude,
    int radiusM = 10000,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl/v1/public/installations/$installationId/nearby'),
          headers: _headers(),
          body: jsonEncode({
            'latitude': latitude,
            'longitude': longitude,
            'radiusM': radiusM,
          }),
        )
        .timeout(const Duration(seconds: 8));
    final payload = (_decode(response) as Map).cast<String, dynamic>();
    return (payload['events'] as List)
        .map(
          (value) =>
              NearbyEvent.fromJson((value as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  Future<JoinSession> resolveQr(
    String scannedValue, {
    String? installationId,
    String? participantToken,
  }) async {
    final scannedUri = Uri.tryParse(scannedValue);
    final token = scannedUri?.scheme == 'onepixel'
        ? scannedUri?.queryParameters['token']
        : scannedValue;
    if (token == null || token.length < 20) {
      throw const OnePixelApiException(
        'QR_INVALID',
        'Questo non è un QR onePixel valido',
      );
    }
    final body = <String, dynamic>{'token': token};
    if (installationId != null) {
      body['installationId'] = installationId;
    }
    if (participantToken != null) {
      body['participantToken'] = participantToken;
    }
    final response = await _client
        .post(
          Uri.parse('$baseUrl/v1/public/qr/resolve'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 12));
    return _sessionFrom(
      (_decode(response) as Map).cast<String, dynamic>(),
      fallbackToken: token,
    );
  }

  Future<JoinSession> joinByLocation({
    required String eventId,
    required String installationId,
    required double latitude,
    required double longitude,
    String? participantToken,
  }) async {
    final body = <String, dynamic>{
      'installationId': installationId,
      'latitude': latitude,
      'longitude': longitude,
    };
    if (participantToken != null) {
      body['participantToken'] = participantToken;
    }
    final response = await _client
        .post(
          Uri.parse('$baseUrl/v1/public/events/$eventId/join/location'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 12));
    return _sessionFrom((_decode(response) as Map).cast<String, dynamic>());
  }

  Future<Map<String, dynamic>> updateJoinLocation({
    required String eventId,
    required String joinToken,
    required double latitude,
    required double longitude,
  }) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl/v1/public/events/$eventId/join/location/update'),
          headers: _headers(),
          body: jsonEncode({
            'joinToken': joinToken,
            'latitude': latitude,
            'longitude': longitude,
          }),
        )
        .timeout(const Duration(seconds: 8));
    return (_decode(response) as Map).cast<String, dynamic>();
  }

  Future<ParticipantAuthResult> participantLogin({
    required String email,
    required String password,
  }) => _participantAuth('/v1/participant/auth/login', {
    'email': email,
    'password': password,
  });
  Future<ParticipantAuthResult> participantRegister({
    required String name,
    required String email,
    required String password,
  }) => _participantAuth('/v1/participant/auth/register', {
    'name': name,
    'email': email,
    'password': password,
  });
  Future<ParticipantAuthResult> participantGoogle(String idToken) =>
      _participantAuth('/v1/participant/auth/google', {'idToken': idToken});

  Future<ParticipantAuthResult> _participantAuth(
    String path,
    Map<String, dynamic> body,
  ) async {
    final response = await _client
        .post(
          Uri.parse('$baseUrl$path'),
          headers: _headers(),
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 12));
    final payload = (_decode(response) as Map).cast<String, dynamic>();
    return ParticipantAuthResult(
      token: payload['token'] as String,
      profile: ParticipantProfile.fromJson(
        (payload['user'] as Map).cast<String, dynamic>(),
      ),
    );
  }

  Future<ParticipantProfile> participantMe(String token) async {
    final response = await _client
        .get(Uri.parse('$baseUrl/v1/participant/me'), headers: _headers(token))
        .timeout(const Duration(seconds: 8));
    return ParticipantProfile.fromJson(
      (_decode(response) as Map).cast<String, dynamic>(),
    );
  }

  Future<ParticipantProfile> updateParticipant({
    required String token,
    required String name,
    String? avatarUrl,
    required String locale,
    required String theme,
  }) async {
    final response = await _client
        .patch(
          Uri.parse('$baseUrl/v1/participant/me'),
          headers: _headers(token),
          body: jsonEncode({
            'name': name,
            'avatarUrl': avatarUrl,
            'locale': locale,
            'theme': theme,
          }),
        )
        .timeout(const Duration(seconds: 8));
    final payload = (_decode(response) as Map).cast<String, dynamic>();
    return ParticipantProfile.fromJson(payload);
  }

  Future<List<Map<String, dynamic>>> participantEvents(String token) async {
    final response = await _client
        .get(
          Uri.parse('$baseUrl/v1/participant/events'),
          headers: _headers(token),
        )
        .timeout(const Duration(seconds: 8));
    return (_decode(response) as List)
        .map((value) => (value as Map).cast<String, dynamic>())
        .toList();
  }

  Future<void> saveParticipantEvent({
    required String token,
    required String eventId,
    required bool saved,
  }) async {
    final response = await _client
        .put(
          Uri.parse('$baseUrl/v1/participant/events/$eventId/state'),
          headers: _headers(token),
          body: jsonEncode({'saved': saved}),
        )
        .timeout(const Duration(seconds: 8));
    _decode(response);
  }

  Future<List<AppNotification>> notifications(String installationId) async {
    final response = await _client
        .get(
          Uri.parse(
            '$baseUrl/v1/public/installations/$installationId/notifications',
          ),
        )
        .timeout(const Duration(seconds: 8));
    return (_decode(response) as List)
        .map(
          (value) =>
              AppNotification.fromJson((value as Map).cast<String, dynamic>()),
        )
        .toList();
  }

  Future<void> markNotificationRead(
    String installationId,
    String notificationId,
  ) async {
    final response = await _client
        .patch(
          Uri.parse(
            '$baseUrl/v1/public/installations/$installationId/notifications/$notificationId',
          ),
          headers: _headers(),
          body: '{}',
        )
        .timeout(const Duration(seconds: 8));
    _decode(response);
  }

  JoinSession _sessionFrom(
    Map<String, dynamic> payload, {
    String? fallbackToken,
  }) {
    final event = (payload['event'] as Map).cast<String, dynamic>();
    return JoinSession(
      sessionId: payload['sessionId'] as String,
      token: payload['joinToken'] as String? ?? fallbackToken ?? '',
      eventTitle: event['title'] as String,
      realtimeUrl: payload['realtimeUrl'] as String,
      manifest: OfflineManifest.fromJson(
        (payload['manifest'] as Map).cast<String, dynamic>(),
      ),
    );
  }

  Map<String, String> _headers([String? token]) => {
    'content-type': 'application/json',
    if (token != null) 'authorization': 'Bearer $token',
  };
  Uri resolveAsset(String path) => Uri.parse(baseUrl).resolve(path);

  Object _decode(http.Response response) {
    Object payload = <String, dynamic>{};
    if (response.body.isNotEmpty) {
      try {
        payload = jsonDecode(response.body) as Object;
      } on FormatException {
        payload = response.body;
      }
    }
    if (response.statusCode >= 200 && response.statusCode < 300) return payload;
    final error = payload is Map
        ? payload.cast<String, dynamic>()
        : const <String, dynamic>{};
    throw OnePixelApiException(
      error['error'] as String? ?? 'HTTP_${response.statusCode}',
      error['message'] as String? ??
          'Il servizio non è disponibile in questo momento',
    );
  }

  void close() => _client.close();
}
