import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';

const manifestJson = <String, dynamic>{
  'protocolVersion': 1,
  'eventId': 'event',
  'version': 2,
  'startsAt': '2026-08-02T19:00:00.000Z',
  'serverTime': '2026-08-02T18:58:12.123Z',
  'zoneId': 'S01',
  'seatId': '18-42',
  'audioAllowed': true,
  'torchAllowed': false,
  'cues': [
    {
      'durationMs': 3000,
      'zones': ['*'],
      'id': 'cue-a',
      'color': '#D1E66A',
      'atMs': 0,
    },
  ],
  'assets': [],
  'checksum':
      'e6ea75fdb68cd96716a480286587edbb3bfb22869a2c352a055c7f1bcb815539',
};

void main() {
  test(
    'verifica lo stesso JSON canonico del backend indipendentemente dall’ordine delle chiavi',
    () {
      final manifest = OfflineManifest.fromJson(manifestJson);
      expect(manifest.hasValidChecksum, isTrue);
      final tampered = {...manifestJson, 'version': 3};
      expect(OfflineManifest.fromJson(tampered).hasValidChecksum, isFalse);
    },
  );

  test('estrae il token dal deep link e decodifica la sessione QR', () async {
    final mock = MockClient((request) async {
      expect(request.url.path, '/v1/public/qr/resolve');
      expect(jsonDecode(request.body), {
        'token': 'signed-token-value-that-is-long',
      });
      return http.Response(
        jsonEncode({
          'sessionId': '9ee4f150-412b-4de7-af7a-fc65c77a08eb',
          'event': {
            'id': 'event',
            'title': 'Finale Luce',
            'startsAt': '2026-08-02T19:00:00.000Z',
            'status': 'published',
          },
          'manifest': manifestJson,
          'realtimeUrl':
              '/v1/realtime/event?token=signed-token-value-that-is-long',
        }),
        200,
        headers: {'content-type': 'application/json'},
      );
    });
    final api = OnePixelApiClient(
      baseUrl: 'https://api.onepixel.test',
      client: mock,
    );
    final session = await api.resolveQr(
      'onepixel://join?token=signed-token-value-that-is-long',
    );
    expect(session.eventTitle, 'Finale Luce');
    expect(session.manifest.zoneId, 'S01');
    expect(session.manifest.hasValidChecksum, isTrue);
  });
}
