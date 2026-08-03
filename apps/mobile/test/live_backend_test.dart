import 'package:flutter_test/flutter_test.dart';
import 'package:onepixel/core/services/api_client.dart';

const liveApiUrl = String.fromEnvironment('ONEPIXEL_LIVE_API_URL');
const liveQrToken = String.fromEnvironment('ONEPIXEL_LIVE_QR_TOKEN');

void main() {
  test(
    'risolve un QR reale e verifica il manifest prodotto dal backend',
    () async {
      final api = OnePixelApiClient(baseUrl: liveApiUrl);
      final session = await api.resolveQr(liveQrToken);
      expect(session.eventTitle, 'Finale Luce');
      expect(session.manifest.zoneId, 'N1');
      expect(session.manifest.hasValidChecksum, isTrue);
      expect(session.manifest.cues, isNotEmpty);
      api.close();
    },
    skip: liveApiUrl.isEmpty || liveQrToken.isEmpty,
  );
}
