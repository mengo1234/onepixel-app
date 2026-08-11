import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:torch_light/torch_light.dart';
import 'package:vibration/vibration.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

class DeviceEffects {
  final AudioPlayer _player = AudioPlayer();
  bool _torchActive = false;

  Future<void> enterShow() async {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    try {
      await WakelockPlus.enable();
      await ScreenBrightness.instance.setApplicationScreenBrightness(1);
    } catch (_) {
      // Some managed devices prevent application brightness changes.
    }
  }

  Future<void> applyCue(
    TimelineCue cue,
    JoinSession session, {
    required bool audioEnabled,
    required bool torchEnabled,
  }) async {
    final pattern = cue.vibration;
    if (pattern != null && pattern.isNotEmpty) {
      try {
        if (await Vibration.hasVibrator()) {
          await Vibration.vibrate(pattern: [0, ...pattern]);
        }
      } catch (_) {}
    }

    if (audioEnabled &&
        session.manifest.audioAllowed &&
        cue.audioAsset != null) {
      final localPath = session.localAssets[cue.audioAsset];
      try {
        if (localPath != null) {
          await _player.setFilePath(localPath);
        } else if (cue.audioAsset!.startsWith('asset://')) {
          await _player.setAsset(cue.audioAsset!.substring('asset://'.length));
        } else {
          await _player.setUrl(cue.audioAsset!);
        }
        await _player.play();
      } catch (_) {}
    }

    final wantsTorch =
        torchEnabled && session.manifest.torchAllowed && cue.torch == true;
    if (wantsTorch == _torchActive) return;
    try {
      if (wantsTorch && await TorchLight.isTorchAvailable()) {
        await TorchLight.enableTorch();
        _torchActive = true;
      } else if (_torchActive) {
        await TorchLight.disableTorch();
        _torchActive = false;
      }
    } catch (_) {
      _torchActive = false;
    }
  }

  Future<void> exitShow() async {
    try {
      await _player.stop();
      await Vibration.cancel();
      if (_torchActive) await TorchLight.disableTorch();
      _torchActive = false;
      await ScreenBrightness.instance.resetApplicationScreenBrightness();
      await WakelockPlus.disable();
    } catch (_) {}
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  }

  Future<void> dispose() async {
    await exitShow();
    await _player.dispose();
  }
}
