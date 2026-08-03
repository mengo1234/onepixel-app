import 'package:flutter/material.dart';
import 'package:onepixel/core/theme/app_theme.dart';

class PixelMark extends StatelessWidget {
  const PixelMark({super.key, this.showName = true, this.size = 38});

  final bool showName;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'onePixel',
      child: FittedBox(
        fit: BoxFit.scaleDown,
        alignment: Alignment.centerLeft,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: size,
              height: size,
              padding: EdgeInsets.all(size * .22),
              decoration: BoxDecoration(
                color: OnePixelColors.signal,
                borderRadius: BorderRadius.circular(size * .3),
              ),
              child: GridView.builder(
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 2,
                  mainAxisSpacing: 2,
                ),
                itemCount: 9,
                itemBuilder: (context, index) => DecoratedBox(
                  decoration: BoxDecoration(
                    color: OnePixelColors.ink.withValues(
                      alpha: index == 4 ? .35 : .92,
                    ),
                    borderRadius: BorderRadius.circular(1),
                  ),
                ),
              ),
            ),
            if (showName) ...[
              const SizedBox(width: 11),
              Text(
                'onePixel',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -1.1,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
