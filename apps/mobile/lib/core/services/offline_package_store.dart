import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OfflinePackageStore {
  OfflinePackageStore(this.apiClient, {http.Client? client})
    : _client = client ?? http.Client();

  static const _sessionKey = 'onepixel.active-session.v1';
  final OnePixelApiClient apiClient;
  final http.Client _client;

  Future<JoinSession> save(
    JoinSession session, {
    void Function(double progress)? onProgress,
  }) async {
    if (!session.manifest.hasValidChecksum) {
      throw const OnePixelApiException(
        'CHECKSUM_INVALID',
        'Il pacchetto ricevuto non supera la verifica di integrità',
      );
    }
    final localAssets = <String, String>{};
    final directory = Directory(
      '${(await getApplicationSupportDirectory()).path}/events/${session.manifest.eventId}/${session.manifest.version}',
    );
    await directory.create(recursive: true);
    for (var index = 0; index < session.manifest.assets.length; index++) {
      final asset = session.manifest.assets[index];
      final response = await _client
          .get(apiClient.resolveAsset(asset.url))
          .timeout(const Duration(seconds: 30));
      if (response.statusCode != 200 ||
          response.bodyBytes.length != asset.bytes ||
          sha256.convert(response.bodyBytes).toString() != asset.sha256) {
        throw OnePixelApiException(
          'ASSET_INVALID',
          'Asset non valido: ${asset.url}',
        );
      }
      final extension = asset.mimeType
          .split('/')
          .last
          .replaceAll(RegExp(r'[^a-zA-Z0-9]'), '');
      final file = File(
        '${directory.path}/${sha256.convert(utf8.encode(asset.url))}.$extension',
      );
      await file.writeAsBytes(response.bodyBytes, flush: true);
      localAssets[asset.url] = file.path;
      onProgress?.call((index + 1) / session.manifest.assets.length);
    }
    if (session.manifest.assets.isEmpty) onProgress?.call(1);
    final complete = session.copyWith(localAssets: localAssets);
    final preferences = await SharedPreferences.getInstance();
    await preferences.setString(_sessionKey, jsonEncode(complete.toJson()));
    return complete;
  }

  Future<JoinSession?> load() async {
    final preferences = await SharedPreferences.getInstance();
    final raw = preferences.getString(_sessionKey);
    if (raw == null) return null;
    try {
      final session = JoinSession.fromJson(
        (jsonDecode(raw) as Map).cast<String, dynamic>(),
      );
      if (!session.manifest.hasValidChecksum) {
        await clear();
        return null;
      }
      return session;
    } catch (_) {
      await clear();
      return null;
    }
  }

  Future<void> clear() async =>
      (await SharedPreferences.getInstance()).remove(_sessionKey);

  void close() => _client.close();
}
