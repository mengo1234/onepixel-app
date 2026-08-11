import 'package:onepixel/core/models/event_models.dart';

class TimelineEvaluation {
  const TimelineEvaluation({required this.countdownSeconds, this.cue});
  final int countdownSeconds;
  final TimelineCue? cue;
}

TimelineEvaluation evaluateTimeline({
  required OfflineManifest manifest,
  required DateTime serverNow,
  required DateTime origin,
  LiveCommand? command,
}) {
  TimelineCue? cue;
  var cueOrigin = origin;
  if (command?.type == 'cue' && command?.cue != null) {
    final commandCue = command!.cue!;
    cue = commandCue;
    cueOrigin = command.executeAt;
    final elapsed = serverNow.difference(cueOrigin).inMilliseconds;
    if (elapsed < 0 || elapsed >= commandCue.durationMs) cue = null;
  } else {
    final elapsed = serverNow.difference(origin).inMilliseconds;
    for (final candidate in manifest.cues) {
      if (elapsed >= candidate.atMs &&
          elapsed < candidate.atMs + candidate.durationMs) {
        cue = candidate;
        cueOrigin = origin.add(Duration(milliseconds: candidate.atMs));
        break;
      }
    }
  }
  final remaining = cueOrigin.difference(serverNow).inMilliseconds;
  final countdown = remaining > 0 && remaining <= 10000
      ? (remaining / 1000).ceil()
      : 0;
  return TimelineEvaluation(cue: cue, countdownSeconds: countdown);
}
