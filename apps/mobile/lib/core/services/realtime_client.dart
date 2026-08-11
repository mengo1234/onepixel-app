import 'dart:async';
import 'dart:convert';

import 'package:onepixel/core/models/event_models.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class RealtimeClient {
  RealtimeClient({
    required this.apiBaseUrl,
    required this.session,
    required this.onCommand,
    required this.onConnectionChanged,
    this.channelFactory,
  });

  final String apiBaseUrl;
  final JoinSession session;
  final void Function(LiveCommand command) onCommand;
  final void Function(bool connected) onConnectionChanged;
  final WebSocketChannel Function(Uri uri)? channelFactory;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _heartbeat;
  int serverOffsetMs = 0;
  int _lastSequence = 0;

  Future<void> connect() async {
    final httpBase = Uri.parse(apiBaseUrl);
    final realtime = httpBase.resolve(session.realtimeUrl);
    final uri = realtime.replace(
      scheme: realtime.scheme == 'https' ? 'wss' : 'ws',
    );
    final channel = channelFactory?.call(uri) ?? WebSocketChannel.connect(uri);
    _channel = channel;
    await channel.ready.timeout(const Duration(seconds: 8));
    onConnectionChanged(true);
    _subscription = channel.stream.listen(
      _message,
      onDone: () => onConnectionChanged(false),
      onError: (_) => onConnectionChanged(false),
    );
    _sendHeartbeat();
    _heartbeat = Timer.periodic(
      const Duration(seconds: 15),
      (_) => _sendHeartbeat(),
    );
  }

  void _message(dynamic raw) {
    final payload = (jsonDecode(raw as String) as Map).cast<String, dynamic>();
    final serverTime = payload['serverTime'] as String?;
    if (serverTime != null) {
      serverOffsetMs = DateTime.parse(
        serverTime,
      ).difference(DateTime.now().toUtc()).inMilliseconds;
    }
    if (payload['type'] != 'command') return;
    final command = LiveCommand.fromJson(
      (payload['command'] as Map).cast<String, dynamic>(),
    );
    if (command.sequence <= _lastSequence) return;
    _lastSequence = command.sequence;
    onCommand(command);
  }

  void _sendHeartbeat() {
    _channel?.sink.add(
      jsonEncode({
        'type': 'heartbeat',
        'sessionId': session.sessionId,
        'zoneId': session.manifest.zoneId,
        'packageVersion': session.manifest.version,
        'clockOffsetMs': serverOffsetMs,
        'ready': true,
      }),
    );
  }

  Future<void> close() async {
    _heartbeat?.cancel();
    await _subscription?.cancel();
    await _channel?.sink.close();
    onConnectionChanged(false);
  }
}
