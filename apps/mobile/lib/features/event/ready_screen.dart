import 'package:flutter/material.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/widgets/pixel_background.dart';
import 'package:onepixel/widgets/pixel_mark.dart';
import 'package:onepixel/widgets/primary_action.dart';

class ReadyScreen extends StatelessWidget {
  const ReadyScreen({
    super.key,
    required this.audioEnabled,
    required this.flashEnabled,
    required this.onAudioChanged,
    required this.onFlashChanged,
    required this.onStart,
    required this.onChangeAccess,
    this.placeLabel = 'Settore N1 · Fila 18 · Posto 42',
    this.audioAllowed = true,
    this.flashAllowed = true,
    this.eventTitle = 'onePixel',
    this.organizationName = 'onePixel',
    this.brandColor,
  });

  final bool audioEnabled;
  final bool flashEnabled;
  final ValueChanged<bool> onAudioChanged;
  final ValueChanged<bool> onFlashChanged;
  final VoidCallback onStart;
  final VoidCallback onChangeAccess;
  final String placeLabel;
  final bool audioAllowed;
  final bool flashAllowed;
  final String eventTitle;
  final String organizationName;
  final String? brandColor;

  Color get accent {
    final raw = brandColor?.replaceFirst('#', '');
    final value = raw == null ? null : int.tryParse('FF$raw', radix: 16);
    return raw?.length == 6 && value != null
        ? Color(value)
        : OnePixelColors.signal;
  }

  Future<void> _confirmChangeAccess(BuildContext context) async {
    final strings = AppStrings.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(strings.text('Cambiare accesso?', 'Change access?')),
        content: Text(
          strings.text(
            'Il pacchetto offline attuale verrà rimosso. Potrai entrare di nuovo con GPS o scansionando un altro QR.',
            'The current offline package will be removed. You can join again with GPS or scan another QR code.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(strings.text('Annulla', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(strings.text('Cambia accesso', 'Change access')),
          ),
        ],
      ),
    );
    if (confirmed == true) onChangeAccess();
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Scaffold(
      body: PixelBackground(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Expanded(child: PixelMark(size: 34)),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 11,
                      vertical: 7,
                    ),
                    decoration: BoxDecoration(
                      color: accent.withValues(alpha: .08),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: accent.withValues(alpha: .2)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        SizedBox(
                          width: 7,
                          height: 7,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: accent,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                        const SizedBox(width: 7),
                        Text(
                          strings.text('PRONTO OFFLINE', 'READY OFFLINE'),
                          style: TextStyle(
                            color: accent,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 42),
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: accent,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: OnePixelColors.ink,
                  size: 38,
                ),
              ),
              const SizedBox(height: 26),
              Text(
                '$organizationName · $eventTitle',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: accent,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: .6,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                strings.text('TUTTO SINCRONIZZATO', 'EVERYTHING SYNCED'),
                style: Theme.of(context).textTheme.labelSmall,
              ),
              const SizedBox(height: 12),
              Text(
                strings.text('Il tuo posto\nè pronto.', 'Your seat\nis ready.'),
                style: Theme.of(context).textTheme.displayLarge,
              ),
              const SizedBox(height: 18),
              Text(
                placeLabel,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: OnePixelColors.paper,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 36),
              Container(
                decoration: BoxDecoration(
                  color: OnePixelColors.inkSoft,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: .08),
                  ),
                ),
                child: Column(
                  children: [
                    _PermissionToggle(
                      icon: Icons.volume_up_rounded,
                      title: strings.text('Audio sul telefono', 'Phone audio'),
                      subtitle: audioAllowed
                          ? strings.text(
                              'Abilitato dalla regia, scegli tu',
                              'Enabled by control, you decide',
                            )
                          : strings.text(
                              'Non previsto dalla regia',
                              'Not enabled by control',
                            ),
                      accent: accent,
                      value: audioEnabled,
                      onChanged: audioAllowed ? onAudioChanged : null,
                    ),
                    const Divider(
                      height: 1,
                      indent: 20,
                      endIndent: 20,
                      color: Color(0xFF292F31),
                    ),
                    _PermissionToggle(
                      icon: Icons.flash_on_rounded,
                      title: strings.text(
                        'Flash sincronizzato',
                        'Synchronized flashlight',
                      ),
                      subtitle: flashAllowed
                          ? strings.text(
                              'Usato solo durante la sequenza',
                              'Used only during the sequence',
                            )
                          : strings.text(
                              'Non previsto dalla regia',
                              'Not enabled by control',
                            ),
                      accent: accent,
                      value: flashEnabled,
                      onChanged: flashAllowed ? onFlashChanged : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              PrimaryAction(
                label: strings.text(
                  'Apri modalità spettacolo',
                  'Open show mode',
                ),
                onPressed: onStart,
                icon: Icons.fullscreen_rounded,
                skin: ActionSkin.amber,
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => _confirmChangeAccess(context),
                icon: const Icon(Icons.swap_horiz_rounded, size: 18),
                label: Text(
                  strings.text('Cambia evento o posto', 'Change event or seat'),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  foregroundColor: OnePixelColors.paper,
                  side: BorderSide(
                    color: OnePixelColors.paper.withValues(alpha: .2),
                  ),
                  shape: const StadiumBorder(),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                strings.text(
                  'Lo schermo resterà acceso e la luminosità aumenterà solo durante la coreografia.',
                  'The screen stays awake and brightness increases only during the choreography.',
                ),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF697170),
                  fontSize: 10,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PermissionToggle extends StatelessWidget {
  const _PermissionToggle({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.accent = OnePixelColors.signal,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .045),
              borderRadius: BorderRadius.circular(13),
            ),
            child: Icon(icon, size: 19, color: accent),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: OnePixelColors.muted,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
