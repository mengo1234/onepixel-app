import 'dart:async';

import 'package:flutter/material.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/device_effects.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/core/timeline/timeline_engine.dart';

class ShowScreen extends StatefulWidget {
  const ShowScreen({
    super.key,
    required this.session,
    required this.audioEnabled,
    required this.flashEnabled,
    required this.connected,
    required this.serverOffsetMs,
    required this.onExit,
    this.command,
    this.effects,
  });

  final JoinSession session;
  final bool audioEnabled;
  final bool flashEnabled;
  final bool connected;
  final int serverOffsetMs;
  final VoidCallback onExit;
  final LiveCommand? command;
  final DeviceEffects? effects;

  @override
  State<ShowScreen> createState() => _ShowScreenState();
}

class _ShowScreenState extends State<ShowScreen> {
  late final DeviceEffects _effects;
  late DateTime _origin;
  Timer? _ticker;
  TimelineCue? _activeCue;
  int _remainingSeconds = 0;
  bool _ownsEffects = false;

  @override
  void initState() {
    super.initState();
    _ownsEffects = widget.effects == null;
    _effects = widget.effects ?? DeviceEffects();
    _origin = widget.command?.type == 'start'
        ? widget.command!.executeAt
        : widget.session.manifest.startsAt;
    unawaited(_effects.enterShow());
    _ticker = Timer.periodic(const Duration(milliseconds: 50), (_) => _tick());
    _tick();
  }

  @override
  void didUpdateWidget(covariant ShowScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    final command = widget.command;
    if (command != null && command.sequence != oldWidget.command?.sequence) {
      if (command.type == 'stop') {
        widget.onExit();
      } else if (command.type == 'start') {
        _origin = command.executeAt;
      }
      _tick();
    }
  }

  DateTime get _serverNow =>
      DateTime.now().toUtc().add(Duration(milliseconds: widget.serverOffsetMs));

  void _tick() {
    if (!mounted) return;
    final evaluation = evaluateTimeline(
      manifest: widget.session.manifest,
      serverNow: _serverNow,
      origin: _origin,
      command: widget.command,
    );
    final nextCue = evaluation.cue;
    final countdown = evaluation.countdownSeconds;
    final cueChanged = nextCue?.id != _activeCue?.id;
    if (cueChanged) {
      _activeCue = nextCue;
      if (nextCue != null) {
        unawaited(
          _effects.applyCue(
            nextCue,
            widget.session,
            audioEnabled: widget.audioEnabled,
            torchEnabled: widget.flashEnabled,
          ),
        );
      }
    }
    if (_remainingSeconds != countdown || cueChanged) {
      setState(() => _remainingSeconds = countdown);
    }
  }

  Color _parseColor(String? value) {
    if (value == null || !RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
      return OnePixelColors.ink;
    }
    return Color(int.parse('FF${value.substring(1)}', radix: 16));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    unawaited(_effects.exitShow());
    if (_ownsEffects) unawaited(_effects.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final color = _parseColor(_activeCue?.color);
    final foreground = color.computeLuminance() > .35
        ? OnePixelColors.ink
        : OnePixelColors.paper;
    final locale = Localizations.localeOf(context).languageCode;
    final cueText =
        _activeCue?.text?[locale] as String? ??
        _activeCue?.text?['it'] as String?;
    final waiting = _activeCue == null && _remainingSeconds == 0;

    return Scaffold(
      body: AnimatedContainer(
        duration: const Duration(milliseconds: 110),
        color: color,
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(22),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${widget.session.manifest.zoneId}${widget.session.manifest.seatId == null ? '' : ' · ${widget.session.manifest.seatId}'}',
                      style: TextStyle(
                        color: foreground.withValues(alpha: .68),
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Row(
                      children: [
                        Semantics(
                          label: widget.audioEnabled
                              ? strings.text('Audio attivo', 'Audio on')
                              : strings.text('Audio disattivato', 'Audio off'),
                          child: Icon(
                            widget.audioEnabled
                                ? Icons.volume_up_rounded
                                : Icons.volume_off_rounded,
                            color: foreground.withValues(alpha: .72),
                            size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Semantics(
                          label: widget.connected
                              ? strings.text(
                                  'Regia collegata',
                                  'Control connected',
                                )
                              : strings.text(
                                  'Modalità offline attiva',
                                  'Offline mode active',
                                ),
                          child: Icon(
                            widget.connected
                                ? Icons.wifi_rounded
                                : Icons.offline_bolt_rounded,
                            color: foreground.withValues(alpha: .72),
                            size: 18,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const Spacer(),
                if (_remainingSeconds > 0) ...[
                  Text(
                    strings.text('INIZIAMO TRA', 'STARTING IN'),
                    style: TextStyle(
                      color: foreground.withValues(alpha: .62),
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      '$_remainingSeconds',
                      style: TextStyle(
                        color: foreground,
                        fontSize: 154,
                        height: .85,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -10,
                      ),
                    ),
                  ),
                ] else if (waiting) ...[
                  Icon(
                    Icons.offline_bolt_rounded,
                    color: OnePixelColors.signal,
                    size: 44,
                  ),
                  const SizedBox(height: 20),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      strings.text('PRONTO\nIN ATTESA', 'READY\nWAITING'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: OnePixelColors.paper,
                        fontSize: 52,
                        height: .9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -3,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    strings.text(
                      'Il pacchetto è sul telefono. La sequenza partirà anche senza rete.',
                      'The package is on your phone. The sequence will start even without a network.',
                    ),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: OnePixelColors.muted,
                      fontSize: 12,
                      height: 1.5,
                    ),
                  ),
                ] else ...[
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      cueText ??
                          strings.text('ALZA\nLA LUCE', 'RAISE\nYOUR LIGHT'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: foreground,
                        fontSize: 70,
                        height: .86,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -4.2,
                      ),
                    ),
                  ),
                ],
                const Spacer(),
                Semantics(
                  button: true,
                  label: strings.text(
                    'Tieni premuto per uscire dalla modalità spettacolo',
                    'Hold to exit show mode',
                  ),
                  child: Material(
                    color: foreground.withValues(alpha: .09),
                    shape: StadiumBorder(
                      side: BorderSide(
                        color: foreground.withValues(alpha: .14),
                      ),
                    ),
                    child: InkWell(
                      onLongPress: widget.onExit,
                      onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            strings.text(
                              'Tieni premuto il pulsante per uscire.',
                              'Press and hold the button to exit.',
                            ),
                          ),
                          duration: const Duration(seconds: 2),
                        ),
                      ),
                      customBorder: const StadiumBorder(),
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 48),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 18),
                          child: Center(
                            child: Text(
                              strings.text(
                                'Tieni premuto per uscire',
                                'Hold to exit',
                              ),
                              style: TextStyle(
                                color: foreground.withValues(alpha: .72),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
