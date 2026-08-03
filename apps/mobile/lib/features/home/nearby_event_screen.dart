import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart' show LatLng;
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/features/home/notification_center.dart';
import 'package:onepixel/features/home/profile_screen.dart';
import 'package:onepixel/widgets/pixel_mark.dart';
import 'package:onepixel/widgets/primary_action.dart';

class NearbyEventScreen extends StatefulWidget {
  const NearbyEventScreen({
    super.key,
    required this.onEnter,
    required this.onDemo,
    this.onJoinGps,
    this.onRefresh,
    this.event,
    this.discoveryMessage,
    this.discovering = false,
    this.api,
    this.installationId = 'onepixel-installation-pending',
    this.participantToken,
    this.profile,
    this.onAuthenticated,
    this.onProfileUpdated,
    this.onSignOut,
    this.onThemeChanged,
    this.onLocaleChanged,
    this.themeMode = ThemeMode.system,
    this.locale,
    this.testMode = false,
  });

  final VoidCallback onEnter;
  final VoidCallback onDemo;
  final VoidCallback? onJoinGps;
  final Future<void> Function()? onRefresh;
  final NearbyEvent? event;
  final String? discoveryMessage;
  final bool discovering;
  final OnePixelApiClient? api;
  final String installationId;
  final String? participantToken;
  final ParticipantProfile? profile;
  final ValueChanged<ParticipantAuthResult>? onAuthenticated;
  final ValueChanged<ParticipantProfile>? onProfileUpdated;
  final VoidCallback? onSignOut;
  final ValueChanged<ThemeMode>? onThemeChanged;
  final ValueChanged<Locale>? onLocaleChanged;
  final ThemeMode themeMode;
  final Locale? locale;
  final bool testMode;

  @override
  State<NearbyEventScreen> createState() => _NearbyEventScreenState();
}

class _NearbyEventScreenState extends State<NearbyEventScreen> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      _HomePage(
        widget: widget,
        onOpenNotifications: () => setState(() => index = 1),
      ),
      widget.api == null
          ? const SizedBox()
          : NotificationCenter(
              api: widget.api!,
              installationId: widget.installationId,
            ),
      widget.api == null
          ? const SizedBox()
          : ProfileScreen(
              api: widget.api!,
              token: widget.participantToken,
              profile: widget.profile,
              themeMode: widget.themeMode,
              locale: widget.locale,
              onAuthenticated: widget.onAuthenticated ?? (_) {},
              onProfileUpdated: widget.onProfileUpdated ?? (_) {},
              onSignOut: widget.onSignOut ?? () {},
              onThemeChanged: widget.onThemeChanged ?? (_) {},
              onLocaleChanged: widget.onLocaleChanged ?? (_) {},
            ),
    ];
    return Scaffold(
      // Lascia che il contenuto continui dietro la barra: la rientranza del
      // pulsante QR mostra cosi lo sfondo della pagina, invece di confondersi
      // con il colore della barra inferiore.
      extendBody: true,
      body: IndexedStack(index: index, children: pages),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: FloatingActionButton.large(
        onPressed: widget.onEnter,
        tooltip: AppStrings.of(context).text('Scansiona il QR', 'Scan the QR'),
        backgroundColor: OnePixelColors.signal,
        foregroundColor: OnePixelColors.ink,
        elevation: 8,
        shape: const CircleBorder(),
        child: const Icon(Icons.qr_code_scanner_rounded, size: 29),
      ),
      bottomNavigationBar: BottomAppBar(
        height: 76,
        padding: EdgeInsets.zero,
        color: Theme.of(context).brightness == Brightness.dark
            ? OnePixelColors.inkSoft.withValues(alpha: .98)
            : Colors.white.withValues(alpha: .98),
        elevation: 16,
        shadowColor: Colors.black.withValues(alpha: .28),
        surfaceTintColor: Colors.transparent,
        shape: const CircularNotchedRectangle(),
        notchMargin: 12,
        child: Row(
          children: [
            Expanded(
              child: _NavItem(
                active: index == 0,
                icon: Icons.home_rounded,
                label: AppStrings.of(context).text('Home', 'Home'),
                onTap: () => setState(() => index = 0),
              ),
            ),
            // Spazio vuoto reale: non contiene una voce di navigazione e
            // segue il diametro del QR piu il margine della rientranza.
            const SizedBox(width: 120),
            Expanded(
              child: _NavItem(
                active: index == 2,
                icon: Icons.person_rounded,
                label: AppStrings.of(context).text('Profilo', 'Profile'),
                onTap: () => setState(() => index = 2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomePage extends StatelessWidget {
  const _HomePage({required this.widget, required this.onOpenNotifications});
  final NearbyEventScreen widget;
  final VoidCallback onOpenNotifications;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final event = widget.event;
    final title =
        event?.title ??
        strings.text('Scansiona il tuo accesso', 'Scan your access');
    final venue =
        event?.venueName ?? strings.text('Evento onePixel', 'onePixel event');
    final distance = event == null
        ? strings.text('QR richiesto', 'QR required')
        : event.distanceM < 1000
        ? '${event.distanceM} m'
        : '${(event.distanceM / 1000).toStringAsFixed(1)} km';
    final canGps =
        event?.accessMethods.any(
          (method) => method == 'fixed_geofence' || method == 'mobile_radius',
        ) ??
        false;
    return SafeArea(
      bottom: false,
      child: RefreshIndicator(
        onRefresh: widget.onRefresh ?? () async {},
        color: OnePixelColors.signal,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 100),
          children: [
            Row(
              children: [
                const Expanded(child: PixelMark(size: 34)),
                _AlertsButton(onTap: onOpenNotifications),
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 11,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: OnePixelColors.signal.withValues(alpha: .09),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: OnePixelColors.signal.withValues(alpha: .22),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 14,
                        color: OnePixelColors.signal,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        strings.text('VICINO A TE', 'NEAR YOU'),
                        style: const TextStyle(
                          color: OnePixelColors.signal,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 30),
            Text(
              strings.text('EVENTI DAL VIVO, INSIEME', 'LIVE EVENTS, TOGETHER'),
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 11),
            Text(
              strings.text(
                'La tua luce\nserve qui.',
                'Your light\nis needed here.',
              ),
              style: Theme.of(
                context,
              ).textTheme.displayLarge?.copyWith(fontSize: 47),
            ),
            const SizedBox(height: 14),
            Text(
              widget.discoveryMessage ??
                  strings.text(
                    'Trova l’evento vicino, entra con GPS o inquadra il QR del tuo settore e diventa parte della coreografia.',
                    'Find the nearby event, join by GPS or scan your section QR and become part of the choreography.',
                  ),
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (widget.discovering) ...[
              const SizedBox(height: 14),
              Row(
                children: [
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: OnePixelColors.signal,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(
                    strings.text(
                      'Ricerca degli eventi vicini…',
                      'Looking for nearby events…',
                    ),
                    style: const TextStyle(
                      color: OnePixelColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 22),
            _EventHero(
              title: title,
              venue: venue,
              distance: distance,
              event: event,
              onSave:
                  event == null ||
                      widget.api == null ||
                      widget.participantToken == null
                  ? null
                  : () async {
                      try {
                        await widget.api!.saveParticipantEvent(
                          token: widget.participantToken!,
                          eventId: event.id,
                          saved: true,
                        );
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                strings.text(
                                  'Evento salvato nel profilo',
                                  'Event saved to your profile',
                                ),
                              ),
                            ),
                          );
                        }
                      } on OnePixelApiException catch (caught) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(caught.message)),
                          );
                        }
                      }
                    },
            ),
            const SizedBox(height: 12),
            if (canGps && widget.onJoinGps != null) ...[
              PrimaryAction(
                label: strings.text(
                  'Entra automaticamente con GPS',
                  'Join automatically with GPS',
                ),
                onPressed: widget.discovering ? null : widget.onJoinGps!,
                icon: Icons.near_me_rounded,
                skin: ActionSkin.signal,
              ),
              const SizedBox(height: 10),
            ],
            PrimaryAction(
              label: strings.text(
                'Prova la coreografia demo',
                'Try the demo choreography',
              ),
              onPressed: widget.onDemo,
              icon: Icons.play_arrow_rounded,
              skin: ActionSkin.charcoal,
            ),
            const SizedBox(height: 10),
            Center(
              child: Text(
                strings.text('Non serve registrarsi', 'No registration needed'),
                style: const TextStyle(
                  color: OnePixelColors.muted,
                  fontSize: 10,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  strings.text('MAPPA EVENTI', 'EVENT MAP'),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                Text(
                  distance,
                  style: const TextStyle(
                    color: OnePixelColors.signal,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            _MapCard(event: event, testMode: widget.testMode),
          ],
        ),
      ),
    );
  }
}

class _EventHero extends StatelessWidget {
  const _EventHero({
    required this.title,
    required this.venue,
    required this.distance,
    required this.event,
    this.onSave,
  });
  final String title;
  final String venue;
  final String distance;
  final NearbyEvent? event;
  final Future<void> Function()? onSave;
  @override
  Widget build(BuildContext context) {
    final place = event?.locationName.isNotEmpty == true
        ? '${event!.locationName} · $venue'
        : venue;
    return Container(
      height: 224,
      decoration: BoxDecoration(
        color: OnePixelColors.inkSoft,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: Colors.white.withValues(alpha: .09)),
        boxShadow: [
          BoxShadow(
            color: OnePixelColors.signal.withValues(alpha: .04),
            blurRadius: 34,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(29),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned.fill(
              top: -18,
              bottom: 30,
              child: Image.asset(
                'assets/artwork/onepixel-stadium-transparent-v2.png',
                fit: BoxFit.contain,
                alignment: Alignment.topCenter,
                filterQuality: FilterQuality.high,
              ),
            ),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Color(0x220B0D0E),
                    Color(0xF20B0D0E),
                  ],
                  stops: [0, .42, 1],
                ),
              ),
            ),
            Positioned(
              left: 16,
              right: 16,
              top: 15,
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 9,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: OnePixelColors.ink.withValues(alpha: .75),
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: .1),
                      ),
                    ),
                    child: Text(
                      (event?.kind ?? 'ONEPIXEL').toUpperCase(),
                      style: const TextStyle(
                        color: OnePixelColors.signal,
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (onSave != null) ...[
                    Material(
                      color: OnePixelColors.ink.withValues(alpha: .78),
                      shape: const CircleBorder(),
                      child: InkWell(
                        onTap: onSave,
                        customBorder: const CircleBorder(),
                        child: const SizedBox(
                          width: 34,
                          height: 34,
                          child: Icon(
                            Icons.bookmark_add_outlined,
                            color: OnePixelColors.signal,
                            size: 17,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    distance,
                    style: const TextStyle(
                      color: OnePixelColors.paper,
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 17,
              right: 17,
              bottom: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: OnePixelColors.paper,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -.6,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Row(
                    children: [
                      const Icon(
                        Icons.location_on_outlined,
                        size: 13,
                        color: OnePixelColors.signal,
                      ),
                      const SizedBox(width: 5),
                      Expanded(
                        child: Text(
                          place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: OnePixelColors.muted,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _MapCard extends StatelessWidget {
  const _MapCard({required this.event, required this.testMode});
  final NearbyEvent? event;
  final bool testMode;
  @override
  Widget build(BuildContext context) {
    final center = LatLng(
      event?.latitude ?? 45.4781,
      event?.longitude ?? 9.124,
    );
    return Container(
      height: 190,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: OnePixelColors.inkSoft,
        borderRadius: BorderRadius.circular(27),
        border: Border.all(color: Colors.white.withValues(alpha: .09)),
      ),
      child: testMode
          ? _MapPlaceholder(center: center)
          : FlutterMap(
              options: MapOptions(
                initialCenter: center,
                initialZoom: 14.5,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.onepixel.onepixel',
                ),
                CircleLayer(
                  circles: [
                    CircleMarker(
                      point: center,
                      radius: 34,
                      useRadiusInMeter: false,
                      color: OnePixelColors.signal.withValues(alpha: .11),
                      borderColor: OnePixelColors.signal.withValues(alpha: .35),
                      borderStrokeWidth: 1,
                    ),
                  ],
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: center,
                      width: 48,
                      height: 48,
                      child: Container(
                        decoration: BoxDecoration(
                          color: OnePixelColors.signal,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: OnePixelColors.ink,
                            width: 4,
                          ),
                          boxShadow: const [
                            BoxShadow(color: Colors.black38, blurRadius: 12),
                          ],
                        ),
                        child: const Icon(
                          Icons.bolt_rounded,
                          color: OnePixelColors.ink,
                          size: 21,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({required this.center});
  final LatLng center;
  @override
  Widget build(BuildContext context) => CustomPaint(
    painter: _MapPainter(),
    child: const Center(
      child: CircleAvatar(
        radius: 22,
        backgroundColor: OnePixelColors.signal,
        child: Icon(Icons.bolt_rounded, color: OnePixelColors.ink),
      ),
    ),
  );
}

class _MapPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final road = Paint()
      ..color = Colors.white.withValues(alpha: .08)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    for (var i = 0; i < 6; i++) {
      final y = size.height * (i + 1) / 7;
      canvas.drawPath(
        Path()
          ..moveTo(0, y)
          ..quadraticBezierTo(size.width * .45, y - 28, size.width, y + 12),
        road,
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
  });
  final bool active;
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) {
    final color = active ? OnePixelColors.signal : OnePixelColors.muted;
    return Semantics(
      button: true,
      selected: active,
      label: label,
      child: InkResponse(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 9,
                fontWeight: active ? FontWeight.w800 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AlertsButton extends StatelessWidget {
  const _AlertsButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final label = strings.text('Avvisi', 'Alerts');
    return Semantics(
      button: true,
      label: strings.text('Apri notifiche', 'Open notifications'),
      child: Tooltip(
        message: strings.text('Apri notifiche', 'Open notifications'),
        child: Material(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(15),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(15),
            child: SizedBox(
              width: 48,
              height: 48,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.notifications_outlined,
                    size: 19,
                    color: OnePixelColors.signal,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    label,
                    style: const TextStyle(
                      color: OnePixelColors.muted,
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
