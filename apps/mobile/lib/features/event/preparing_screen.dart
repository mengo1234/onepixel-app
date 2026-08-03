import 'dart:async';

import 'package:flutter/material.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/widgets/pixel_background.dart';
import 'package:onepixel/widgets/pixel_mark.dart';
import 'package:onepixel/widgets/primary_action.dart';

class PreparingScreen extends StatefulWidget {
  const PreparingScreen({
    super.key,
    required this.onComplete,
    this.prepare,
    this.onCancel,
  });

  final VoidCallback onComplete;
  final Future<void> Function()? prepare;
  final VoidCallback? onCancel;

  @override
  State<PreparingScreen> createState() => _PreparingScreenState();
}

class _PreparingScreenState extends State<PreparingScreen> {
  Timer? _timer;
  double _progress = .08;
  String? _error;

  @override
  void initState() {
    super.initState();
    _beginPreparation();
  }

  void _startProgressTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(milliseconds: 210), (timer) {
      if (!mounted) return;
      setState(() {
        _progress = (_progress + .045).clamp(0, .9);
      });
    });
  }

  void _beginPreparation() {
    setState(() {
      _progress = .08;
      _error = null;
    });
    _startProgressTimer();
    unawaited(_prepare());
  }

  Future<void> _prepare() async {
    try {
      if (widget.prepare != null) {
        await widget.prepare!();
      } else {
        await Future<void>.delayed(const Duration(seconds: 4));
      }
      if (!mounted) return;
      _timer?.cancel();
      setState(() => _progress = 1);
      await Future<void>.delayed(const Duration(milliseconds: 580));
      if (mounted) widget.onComplete();
    } catch (error) {
      if (!mounted) return;
      _timer?.cancel();
      final strings = AppStrings.of(context);
      setState(() {
        _error = error is OnePixelApiException
            ? error.message
            : strings.text(
                'Non riesco a preparare il pacchetto. Controlla Internet e riprova.',
                'Unable to prepare the package. Check your connection and try again.',
              );
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final percentage = (_progress * 100).round();
    final completedItems = _progress < .42
        ? 1
        : _progress < .76
        ? 2
        : 3;

    return Scaffold(
      body: PixelBackground(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const PixelMark(),
              const SizedBox(height: 52),
              Text(
                strings.text('PACCHETTO DEL TUO POSTO', 'YOUR SEAT PACKAGE'),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const SizedBox(height: 14),
              Text(
                strings.text(
                  'Prepariamo\nil tuo pixel.',
                  'Preparing\nyour pixel.',
                ),
                style: Theme.of(context).textTheme.displayLarge,
              ),
              const SizedBox(height: 18),
              Text(
                strings.text(
                  'Scarichiamo tutto ora. La coreografia continuerà anche senza rete.',
                  'Everything downloads now. The choreography will continue even without a network.',
                ),
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 42),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$percentage',
                    style: const TextStyle(
                      color: OnePixelColors.paper,
                      fontSize: 76,
                      height: .8,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -5,
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 4, left: 4),
                    child: Text(
                      '%',
                      style: TextStyle(
                        color: OnePixelColors.signal,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 22),
              ClipRRect(
                borderRadius: BorderRadius.circular(99),
                child: LinearProgressIndicator(
                  value: _progress,
                  minHeight: 8,
                  color: OnePixelColors.signal,
                  backgroundColor: Colors.white.withValues(alpha: .08),
                ),
              ),
              const SizedBox(height: 28),
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: OnePixelColors.inkSoft,
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    _DownloadRow(
                      icon: Icons.schedule_rounded,
                      label: strings.text(
                        'Sincronizzazione orario',
                        'Clock synchronization',
                      ),
                      complete: completedItems >= 1,
                    ),
                    const Divider(height: 28, color: Color(0xFF292F31)),
                    _DownloadRow(
                      icon: Icons.animation_rounded,
                      label: strings.text(
                        'Timeline e colori',
                        'Timeline and colors',
                      ),
                      complete: completedItems >= 2,
                    ),
                    const Divider(height: 28, color: Color(0xFF292F31)),
                    _DownloadRow(
                      icon: Icons.graphic_eq_rounded,
                      label: strings.text(
                        'Audio e segnali',
                        'Audio and signals',
                      ),
                      complete: completedItems >= 3,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 34),
              if (_error != null) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: OnePixelColors.coral.withValues(alpha: .12),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: OnePixelColors.coral.withValues(alpha: .3),
                    ),
                  ),
                  child: Column(
                    children: [
                      Text(
                        _error!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          color: OnePixelColors.paper,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(height: 10),
                      const SizedBox(height: 14),
                      PrimaryAction(
                        label: strings.text('Riprova', 'Try again'),
                        onPressed: _beginPreparation,
                        icon: Icons.refresh_rounded,
                        skin: ActionSkin.coral,
                      ),
                      const SizedBox(height: 6),
                      TextButton.icon(
                        onPressed: widget.onCancel,
                        icon: const Icon(Icons.qr_code_scanner_rounded),
                        label: Text(
                          strings.text(
                            'Scansiona un altro QR',
                            'Scan another QR code',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ] else
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.lock_outline_rounded,
                      size: 13,
                      color: Color(0xFF697170),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      strings.text(
                        'Pacchetto firmato e verificato',
                        'Signed and verified package',
                      ),
                      style: const TextStyle(
                        color: Color(0xFF697170),
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DownloadRow extends StatelessWidget {
  const _DownloadRow({
    required this.icon,
    required this.label,
    required this.complete,
  });

  final IconData icon;
  final String label;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          icon,
          size: 18,
          color: complete ? OnePixelColors.signal : OnePixelColors.muted,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: complete ? OnePixelColors.paper : OnePixelColors.muted,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        AnimatedSwitcher(
          duration: const Duration(milliseconds: 280),
          child: complete
              ? const Icon(
                  Icons.check_circle_rounded,
                  key: ValueKey('complete'),
                  size: 20,
                  color: OnePixelColors.signal,
                )
              : const SizedBox(
                  key: ValueKey('pending'),
                  width: 17,
                  height: 17,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.8,
                    color: OnePixelColors.muted,
                  ),
                ),
        ),
      ],
    );
  }
}
