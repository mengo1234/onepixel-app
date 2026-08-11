import 'package:flutter/material.dart';

enum ActionSkin {
  signal('assets/buttons/primary-signal-v1.png', Color(0xFF0B0D0E)),
  charcoal('assets/buttons/secondary-charcoal-v1.png', Color(0xFFF2F3ED)),
  amber('assets/buttons/live-amber-v1.png', Color(0xFF0B0D0E)),
  coral('assets/buttons/emergency-coral-v1.png', Color(0xFF0B0D0E)),
  teal('assets/buttons/audio-teal-v1.png', Color(0xFF0B0D0E)),
  paper('assets/buttons/neutral-paper-v1.png', Color(0xFF0B0D0E));

  const ActionSkin(this.asset, this.foreground);

  final String asset;
  final Color foreground;
}

class PrimaryAction extends StatelessWidget {
  const PrimaryAction({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon = Icons.arrow_forward_rounded,
    this.skin = ActionSkin.signal,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData icon;
  final ActionSkin skin;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: SizedBox(
        width: double.infinity,
        height: 64,
        child: Opacity(
          opacity: enabled ? 1 : .45,
          child: Stack(
            fit: StackFit.expand,
            children: [
              IgnorePointer(
                child: Image.asset(
                  skin.asset,
                  fit: BoxFit.fill,
                  scale: 4,
                  centerSlice: const Rect.fromLTRB(27, 27, 87, 30),
                  filterQuality: FilterQuality.high,
                  excludeFromSemantics: true,
                ),
              ),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onPressed,
                  borderRadius: BorderRadius.circular(999),
                  splashColor: Colors.white.withValues(alpha: .14),
                  highlightColor: Colors.black.withValues(alpha: .06),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 23,
                      vertical: 16,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            label,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: skin.foreground,
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Icon(icon, size: 20, color: skin.foreground),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
