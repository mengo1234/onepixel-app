import 'package:flutter_test/flutter_test.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/timeline/timeline_engine.dart';

void main() {
  final origin = DateTime.utc(2026, 8, 2, 19);
  final manifest = OfflineManifest(
    protocolVersion: 1,
    eventId: 'event',
    version: 1,
    startsAt: origin,
    serverTime: origin,
    zoneId: 'N1',
    audioAllowed: true,
    torchAllowed: true,
    checksum: 'fixture',
    assets: const [],
    cues: const [
      TimelineCue(
        id: 'first',
        atMs: 0,
        durationMs: 3000,
        zones: ['N1'],
        color: '#D1E66A',
      ),
      TimelineCue(
        id: 'second',
        atMs: 3000,
        durationMs: 4000,
        zones: ['N1'],
        color: '#77A4A1',
      ),
    ],
  );

  test('esegue la timeline dal pacchetto senza dipendere dalla rete', () {
    expect(
      evaluateTimeline(
        manifest: manifest,
        origin: origin,
        serverNow: origin.add(const Duration(milliseconds: 1200)),
      ).cue?.id,
      'first',
    );
    expect(
      evaluateTimeline(
        manifest: manifest,
        origin: origin,
        serverNow: origin.add(const Duration(milliseconds: 5200)),
      ).cue?.id,
      'second',
    );
    expect(
      evaluateTimeline(
        manifest: manifest,
        origin: origin,
        serverNow: origin.add(const Duration(seconds: 8)),
      ).cue,
      isNull,
    );
  });

  test('usa il comando live solo se è nuovo e nel suo intervallo', () {
    final command = LiveCommand(
      sequence: 8,
      type: 'cue',
      executeAt: origin.add(const Duration(seconds: 10)),
      cue: const TimelineCue(
        id: 'live',
        atMs: 0,
        durationMs: 900,
        zones: ['*'],
        color: '#E2A65A',
      ),
    );
    expect(
      evaluateTimeline(
        manifest: manifest,
        origin: origin,
        serverNow: origin.add(const Duration(milliseconds: 10500)),
        command: command,
      ).cue?.id,
      'live',
    );
    expect(
      evaluateTimeline(
        manifest: manifest,
        origin: origin,
        serverNow: origin.add(const Duration(seconds: 12)),
        command: command,
      ).cue,
      isNull,
    );
  });
}
