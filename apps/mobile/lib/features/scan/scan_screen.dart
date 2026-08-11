import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/widgets/pixel_mark.dart';
import 'package:onepixel/widgets/primary_action.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({
    super.key,
    required this.onBack,
    required this.onCodeResolved,
    this.allowDemo = false,
  });

  final VoidCallback onBack;
  final ValueChanged<String> onCodeResolved;
  final bool allowDemo;

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _scanController;
  MobileScannerController? _cameraController;
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    _scanController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat(reverse: true);
    if (!widget.allowDemo) {
      _cameraController = MobileScannerController(
        detectionSpeed: DetectionSpeed.noDuplicates,
        formats: const [BarcodeFormat.qrCode],
        autoZoom: true,
      );
    }
  }

  @override
  void dispose() {
    _scanController.dispose();
    unawaited(_cameraController?.dispose());
    super.dispose();
  }

  void _detected(BarcodeCapture capture) {
    if (_processing) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value == null || value.isEmpty) continue;
      setState(() => _processing = true);
      unawaited(_cameraController?.stop());
      widget.onCodeResolved(value);
      return;
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Scaffold(
      backgroundColor: OnePixelColors.ink,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 20),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton.filledTonal(
                    onPressed: widget.onBack,
                    icon: const Icon(Icons.arrow_back_rounded),
                    style: IconButton.styleFrom(
                      backgroundColor: OnePixelColors.inkSoft,
                      foregroundColor: OnePixelColors.paper,
                    ),
                  ),
                  const PixelMark(showName: false, size: 36),
                ],
              ),
              const Spacer(),
              Text(
                strings.text('ASSOCIA IL TUO POSTO', 'LINK YOUR SEAT'),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const SizedBox(height: 12),
              Text(
                strings.text('Inquadra il QR', 'Frame the QR code'),
                style: Theme.of(context).textTheme.displayMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 12),
              Text(
                strings.text(
                  'Lo trovi all’ingresso del settore oppure sul tuo posto.',
                  'Find it at the section entrance or on your seat.',
                ),
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 34),
              AspectRatio(
                aspectRatio: 1,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(36),
                  child: Stack(
                    children: [
                      Positioned.fill(
                        child: widget.allowDemo
                            ? const DecoratedBox(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Color(0xFF202729),
                                      Color(0xFF0E1112),
                                    ],
                                  ),
                                ),
                              )
                            : MobileScanner(
                                controller: _cameraController,
                                onDetect: _detected,
                                errorBuilder: (context, error) => Container(
                                  color: const Color(0xFF15191B),
                                  alignment: Alignment.center,
                                  padding: const EdgeInsets.all(28),
                                  child: Text(
                                    '${strings.text('Fotocamera non disponibile', 'Camera unavailable')}\n${error.errorCode.name}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: OnePixelColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ),
                      ),
                      const Positioned.fill(
                        child: CustomPaint(painter: _FinderPainter()),
                      ),
                      AnimatedBuilder(
                        animation: _scanController,
                        builder: (context, child) => Positioned(
                          left: 36,
                          right: 36,
                          top: 42 + _scanController.value * 220,
                          child: Container(
                            height: 2,
                            decoration: BoxDecoration(
                              color: OnePixelColors.signal,
                              boxShadow: [
                                BoxShadow(
                                  color: OnePixelColors.signal.withValues(
                                    alpha: .25,
                                  ),
                                  blurRadius: 14,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              if (widget.allowDemo) ...[
                PrimaryAction(
                  label: strings.text('Simula scansione', 'Simulate scan'),
                  onPressed: () => widget.onCodeResolved('demo'),
                  icon: Icons.center_focus_strong_rounded,
                  skin: ActionSkin.charcoal,
                ),
                const SizedBox(height: 12),
              ],
              Text(
                strings.text(
                  'La fotocamera verrà attivata solo durante la scansione',
                  'The camera is active only while scanning',
                ),
                style: const TextStyle(color: Color(0xFF697170), fontSize: 10),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FinderPainter extends CustomPainter {
  const _FinderPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = OnePixelColors.paper.withValues(alpha: .85)
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 4;
    const length = 42.0;
    const inset = 34.0;

    final corners = [
      (Offset(inset, inset), const Offset(1, 1)),
      (Offset(size.width - inset, inset), const Offset(-1, 1)),
      (Offset(inset, size.height - inset), const Offset(1, -1)),
      (Offset(size.width - inset, size.height - inset), const Offset(-1, -1)),
    ];
    for (final (origin, direction) in corners) {
      canvas.drawLine(origin, origin + Offset(direction.dx * length, 0), paint);
      canvas.drawLine(origin, origin + Offset(0, direction.dy * length), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
