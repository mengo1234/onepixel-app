import 'package:flutter/material.dart';
import 'package:onepixel/core/theme/app_theme.dart';

class PixelBackground extends StatelessWidget {
  const PixelBackground({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: OnePixelColors.ink,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const IgnorePointer(child: CustomPaint(painter: _PixelGridPainter())),
          SafeArea(
            child: Padding(
              padding: padding ?? const EdgeInsets.fromLTRB(20, 18, 20, 20),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

class _PixelGridPainter extends CustomPainter {
  const _PixelGridPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = OnePixelColors.signal.withValues(alpha: .035)
      ..strokeWidth = 1;
    const spacing = 34.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), linePaint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), linePaint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
