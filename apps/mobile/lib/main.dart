import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/core/services/app_session_store.dart';
import 'package:onepixel/core/services/location_service.dart';
import 'package:onepixel/core/services/nearby_notifications.dart';
import 'package:onepixel/core/services/offline_package_store.dart';
import 'package:onepixel/core/services/realtime_client.dart';
import 'package:onepixel/core/theme/app_theme.dart';
import 'package:onepixel/features/event/preparing_screen.dart';
import 'package:onepixel/features/event/ready_screen.dart';
import 'package:onepixel/features/home/nearby_event_screen.dart';
import 'package:onepixel/features/scan/scan_screen.dart';
import 'package:onepixel/features/show/show_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: OnePixelColors.ink,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  final backgroundApi = OnePixelApiClient();
  await scheduleNearbyChecks(backgroundApi.baseUrl);
  backgroundApi.close();
  runApp(const OnePixelApp());
}

enum ExperienceStep { nearby, scan, preparing, ready, show }

class OnePixelApp extends StatefulWidget {
  const OnePixelApp({
    super.key,
    this.testMode = false,
    this.apiClient,
    this.locationService,
    this.offlineStore,
    this.locale,
  });

  final bool testMode;
  final OnePixelApiClient? apiClient;
  final LocationService? locationService;
  final OfflinePackageStore? offlineStore;
  final Locale? locale;

  @override
  State<OnePixelApp> createState() => _OnePixelAppState();
}

class _OnePixelAppState extends State<OnePixelApp> {
  static const _deepLinkChannel = MethodChannel(
    'com.onepixel.onepixel/deep_link',
  );

  ExperienceStep _step = ExperienceStep.nearby;
  bool _audioEnabled = true;
  bool _flashEnabled = true;
  bool _discovering = true;
  bool _connected = false;
  int _serverOffsetMs = 0;
  String? _discoveryMessage;
  String? _pendingQr;
  NearbyEvent? _nearbyEvent;
  JoinSession? _session;
  LiveCommand? _command;
  RealtimeClient? _realtime;
  Timer? _locationUpdateTimer;
  late final OnePixelApiClient _api;
  late final LocationService _location;
  late final OfflinePackageStore _offline;
  late final bool _ownsApi;
  late final bool _ownsOffline;
  final AppSessionStore _sessionStore = AppSessionStore();
  String _installationId = 'onepixel-installation-pending';
  String? _participantToken;
  ParticipantProfile? _profile;
  ThemeMode _themeMode = ThemeMode.dark;
  Locale? _selectedLocale;

  AppStrings get _strings => AppStrings(
    (_selectedLocale ??
            widget.locale ??
            WidgetsBinding.instance.platformDispatcher.locale)
        .languageCode,
  );

  @override
  void initState() {
    super.initState();
    _ownsApi = widget.apiClient == null;
    _api = widget.apiClient ?? OnePixelApiClient();
    _location = widget.locationService ?? LocationService();
    _ownsOffline = widget.offlineStore == null;
    _offline = widget.offlineStore ?? OfflinePackageStore(_api);
    _selectedLocale = widget.locale;
    _deepLinkChannel.setMethodCallHandler((call) async {
      if (call.method == 'onNewLink') {
        _openDeepLink(call.arguments as String?);
      }
    });
    if (widget.testMode) {
      _nearbyEvent = NearbyEvent(
        id: 'event_finale_luce',
        title: 'Finale Luce',
        venueName: 'Arena Nord',
        startsAt: DateTime.now().add(const Duration(hours: 1)),
        distanceM: 640,
      );
      _discovering = false;
    } else {
      unawaited(_initialize());
    }
  }

  Future<void> _initialize() async {
    final settings = await _sessionStore.load();
    if (mounted) {
      setState(() {
        _installationId = settings.installationId;
        _participantToken = settings.participantToken;
        _themeMode = settings.themeMode;
        _selectedLocale = widget.locale ?? settings.locale;
      });
    }
    if (_participantToken != null) {
      try {
        final profile = await _api.participantMe(_participantToken!);
        if (mounted) setState(() => _profile = profile);
      } catch (_) {
        await _sessionStore.saveParticipantToken(null);
        _participantToken = null;
      }
    }
    try {
      await _api.registerInstallation(
        installationId: _installationId,
        locale: _strings.languageCode == 'en' ? 'en' : 'it',
        notificationsEnabled: true,
        locationEnabled: true,
        participantToken: _participantToken,
      );
    } catch (_) {
      // QR and the offline package remain usable if registration is unavailable.
    }
    try {
      final initialLink = await _deepLinkChannel.invokeMethod<String>(
        'getInitialLink',
      );
      if (_openDeepLink(initialLink)) return;
    } on PlatformException {
      // Discovery and QR scanning remain available if the Android bridge fails.
    }
    await _restoreAndDiscover();
  }

  bool _openDeepLink(String? value) {
    if (!mounted || value == null || value.isEmpty) return false;
    final uri = Uri.tryParse(value);
    if (uri?.scheme != 'onepixel' || uri?.host != 'join') return false;
    _acceptQr(value);
    return true;
  }

  Future<void> _restoreAndDiscover() async {
    final saved = await _offline.load();
    if (!mounted) return;
    if (saved != null) {
      setState(() {
        _session = saved;
        _audioEnabled = saved.manifest.audioAllowed;
        _flashEnabled = saved.manifest.torchAllowed;
        _step = ExperienceStep.ready;
      });
      unawaited(_connectRealtime());
      _startLocationUpdates();
      return;
    }
    await _refreshNearby();
  }

  Future<void> _refreshNearby() async {
    if (widget.testMode) return;
    if (mounted) setState(() => _discovering = true);
    try {
      final position = await _location.currentPosition();
      final events = await _api.refreshNearbyInstallation(
        installationId: _installationId,
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (events.isNotEmpty) {
        await NearbyNotifications.initialize(requestPermission: true);
        await NearbyNotifications.notifyOnce(events.first);
      }
      if (!mounted) return;
      final strings = _strings;
      setState(() {
        _nearbyEvent = events.isEmpty ? null : events.first;
        _discoveryMessage = events.isEmpty
            ? strings.text(
                'Nessun evento attivo nelle vicinanze. Puoi comunque entrare scansionando un QR onePixel.',
                'No active event nearby. You can still enter by scanning a onePixel QR code.',
              )
            : null;
        _discovering = false;
      });
    } on LocationUnavailable catch (error) {
      if (mounted) {
        setState(() {
          _discoveryMessage = error.message;
          _discovering = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _discoveryMessage = _strings.text(
            'Ricerca eventi non disponibile. La scansione QR continua a funzionare.',
            'Event discovery is unavailable. QR scanning still works.',
          );
          _discovering = false;
        });
      }
    }
  }

  void _goTo(ExperienceStep step) => setState(() => _step = step);

  void _startDemo() {
    setState(() {
      _session = _demoSession();
      _audioEnabled = true;
      _flashEnabled = true;
      _connected = false;
      _step = ExperienceStep.ready;
    });
  }

  void _startShow() {
    setState(() {
      if (_session?.token == 'demo') _session = _demoSession();
      _step = ExperienceStep.show;
    });
  }

  Future<void> _forgetAccess() async {
    _locationUpdateTimer?.cancel();
    _locationUpdateTimer = null;
    final realtime = _realtime;
    _realtime = null;
    setState(() {
      _session = null;
      _pendingQr = null;
      _command = null;
      _connected = false;
      _serverOffsetMs = 0;
      _step = ExperienceStep.nearby;
    });
    if (!widget.testMode) unawaited(_refreshNearby());
    await realtime?.close();
    await _offline.clear();
  }

  void _acceptQr(String value) {
    setState(() {
      _pendingQr = value;
      _step = ExperienceStep.preparing;
    });
  }

  Future<void> _prepareQr() async {
    if (widget.testMode) {
      _session = _demoSession();
      return;
    }
    final scanned = _pendingQr;
    if (scanned == null) {
      throw const OnePixelApiException(
        'QR_MISSING',
        'Scansiona nuovamente il QR',
      );
    }
    final resolved = await _api.resolveQr(
      scanned,
      installationId: _installationId,
      participantToken: _participantToken,
    );
    final stored = await _offline.save(resolved);
    if (!mounted) return;
    setState(() {
      _session = stored;
      _audioEnabled = stored.manifest.audioAllowed;
      _flashEnabled = stored.manifest.torchAllowed;
    });
    unawaited(_connectRealtime());
    _startLocationUpdates();
  }

  Future<void> _joinNearbyWithGps() async {
    final event = _nearbyEvent;
    if (event == null) return;
    setState(() {
      _discoveryMessage = _strings.text(
        'Verifico la posizione…',
        'Checking your location…',
      );
      _discovering = true;
    });
    try {
      final position = await _location.currentPosition();
      final resolved = await _api.joinByLocation(
        eventId: event.id,
        installationId: _installationId,
        latitude: position.latitude,
        longitude: position.longitude,
        participantToken: _participantToken,
      );
      final stored = await _offline.save(resolved);
      if (!mounted) return;
      setState(() {
        _session = stored;
        _audioEnabled = stored.manifest.audioAllowed;
        _flashEnabled = stored.manifest.torchAllowed;
        _discovering = false;
        _step = ExperienceStep.ready;
      });
      unawaited(_connectRealtime());
      _startLocationUpdates();
    } on Object catch (caught) {
      if (mounted) {
        setState(() {
          _discovering = false;
          _discoveryMessage = caught is OnePixelApiException
              ? caught.message
              : _strings.text(
                  'Non sei ancora nell’area di accesso.',
                  'You are not in the access area yet.',
                );
        });
      }
    }
  }

  void _startLocationUpdates() {
    _locationUpdateTimer?.cancel();
    final session = _session;
    if (session == null || session.token == 'demo' || widget.testMode) return;
    _locationUpdateTimer = Timer.periodic(
      const Duration(seconds: 8),
      (_) => unawaited(_updateJoinedZone()),
    );
  }

  Future<void> _updateJoinedZone() async {
    final session = _session;
    if (session == null || session.token == 'demo') return;
    try {
      final position = await _location.currentPosition();
      final result = await _api.updateJoinLocation(
        eventId: session.manifest.eventId,
        joinToken: session.token,
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (result['changed'] != true || result['manifest'] is! Map) return;
      final updated = JoinSession(
        sessionId: session.sessionId,
        token: result['joinToken'] as String,
        eventTitle: session.eventTitle,
        realtimeUrl: result['realtimeUrl'] as String,
        manifest: OfflineManifest.fromJson(
          (result['manifest'] as Map).cast<String, dynamic>(),
        ),
        localAssets: session.localAssets,
      );
      final stored = await _offline.save(updated);
      if (!mounted) return;
      setState(() => _session = stored);
      await _connectRealtime();
    } catch (_) {
      // Keep the last valid zone and offline package when location is unavailable.
    }
  }

  Future<void> _authenticated(ParticipantAuthResult result) async {
    await _sessionStore.saveParticipantToken(result.token);
    if (!mounted) return;
    setState(() {
      _participantToken = result.token;
      _profile = result.profile;
    });
    try {
      await _api.registerInstallation(
        installationId: _installationId,
        locale: _strings.languageCode == 'en' ? 'en' : 'it',
        notificationsEnabled: true,
        locationEnabled: true,
        participantToken: result.token,
      );
    } catch (_) {}
  }

  void _profileUpdated(ParticipantProfile profile) {
    if (mounted) setState(() => _profile = profile);
  }

  Future<void> _signOutParticipant() async {
    await _sessionStore.saveParticipantToken(null);
    if (mounted) {
      setState(() {
        _participantToken = null;
        _profile = null;
      });
    }
  }

  Future<void> _changeTheme(ThemeMode mode) async {
    await _sessionStore.saveTheme(mode);
    if (mounted) setState(() => _themeMode = mode);
  }

  Future<void> _changeLocale(Locale locale) async {
    await _sessionStore.saveLocale(locale);
    if (mounted) setState(() => _selectedLocale = locale);
  }

  Future<void> _connectRealtime() async {
    final session = _session;
    if (session == null || widget.testMode) return;
    await _realtime?.close();
    final realtime = RealtimeClient(
      apiBaseUrl: _api.baseUrl,
      session: session,
      onConnectionChanged: (connected) {
        if (mounted) setState(() => _connected = connected);
      },
      onCommand: (command) {
        if (!mounted) return;
        setState(() {
          _command = command;
          _serverOffsetMs = _realtime?.serverOffsetMs ?? 0;
          if (command.type == 'stop') {
            _step = ExperienceStep.ready;
          } else if (command.type == 'start' || command.type == 'cue') {
            _step = ExperienceStep.show;
          }
        });
      },
    );
    _realtime = realtime;
    try {
      await realtime.connect();
      if (mounted) setState(() => _serverOffsetMs = realtime.serverOffsetMs);
    } catch (_) {
      if (mounted) setState(() => _connected = false);
    }
  }

  JoinSession _demoSession() {
    final now = DateTime.now().toUtc().add(const Duration(seconds: 3));
    return JoinSession(
      sessionId: '9ee4f150-412b-4de7-af7a-fc65c77a08eb',
      token: 'demo',
      eventTitle: 'Finale Luce',
      realtimeUrl: '',
      manifest: OfflineManifest(
        protocolVersion: 1,
        eventId: 'event_finale_luce',
        version: 1,
        startsAt: now,
        serverTime: DateTime.now().toUtc(),
        zoneId: 'N1',
        seatId: '18-42',
        audioAllowed: true,
        torchAllowed: true,
        brand: const EventBrand(
          organizationName: 'Arena Nord',
          primary: '#D1E66A',
        ),
        checksum: 'demo',
        cues: const [
          TimelineCue(
            id: 'demo-1',
            atMs: 0,
            durationMs: 3000,
            zones: ['*'],
            color: '#D1E66A',
            text: {'it': 'ALZA LA LUCE', 'en': 'RAISE YOUR LIGHT'},
            vibration: [80, 80, 80],
          ),
          TimelineCue(
            id: 'demo-2',
            atMs: 3000,
            durationMs: 3000,
            zones: ['*'],
            color: '#19C6FF',
            text: {'it': 'ONDA BLU', 'en': 'BLUE WAVE'},
          ),
          TimelineCue(
            id: 'demo-3',
            atMs: 6000,
            durationMs: 4200,
            zones: ['*'],
            color: '#FF3D8D',
            text: {'it': 'CANTA CON NOI', 'en': 'SING WITH US'},
            audioAsset: 'asset://assets/audio/onepixel-demo.wav',
            vibration: [180, 100, 180],
            torch: true,
          ),
          TimelineCue(
            id: 'demo-4',
            atMs: 10200,
            durationMs: 4800,
            zones: ['*'],
            color: '#E2A65A',
            text: {'it': 'UN SOLO PIXEL', 'en': 'ONE PIXEL'},
            vibration: [100, 70, 100, 70, 220],
          ),
        ],
        assets: const [],
      ),
    );
  }

  @override
  void dispose() {
    _deepLinkChannel.setMethodCallHandler(null);
    unawaited(_realtime?.close());
    _locationUpdateTimer?.cancel();
    if (_ownsOffline) _offline.close();
    if (_ownsApi) _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = _session;
    final strings = _strings;
    return MaterialApp(
      title: 'onePixel',
      debugShowCheckedModeBanner: false,
      darkTheme: OnePixelTheme.dark,
      theme: OnePixelTheme.light,
      themeMode: _themeMode,
      locale: _selectedLocale ?? widget.locale,
      supportedLocales: const [Locale('it'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AnimatedSwitcher(
        duration: const Duration(milliseconds: 460),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(0.035, 0),
              end: Offset.zero,
            ).animate(animation),
            child: child,
          ),
        ),
        child: switch (_step) {
          ExperienceStep.nearby => NearbyEventScreen(
            key: const ValueKey('nearby'),
            event: _nearbyEvent,
            discoveryMessage: _discoveryMessage,
            discovering: _discovering,
            onEnter: () => _goTo(ExperienceStep.scan),
            onDemo: _startDemo,
            onJoinGps: _joinNearbyWithGps,
            onRefresh: _refreshNearby,
            api: _api,
            installationId: _installationId,
            participantToken: _participantToken,
            profile: _profile,
            onAuthenticated: (result) => unawaited(_authenticated(result)),
            onProfileUpdated: _profileUpdated,
            onSignOut: () => unawaited(_signOutParticipant()),
            onThemeChanged: (mode) => unawaited(_changeTheme(mode)),
            onLocaleChanged: (locale) => unawaited(_changeLocale(locale)),
            themeMode: _themeMode,
            locale: _selectedLocale ?? widget.locale,
            testMode: widget.testMode,
          ),
          ExperienceStep.scan => ScanScreen(
            key: const ValueKey('scan'),
            allowDemo: widget.testMode,
            onBack: () => _goTo(ExperienceStep.nearby),
            onCodeResolved: _acceptQr,
          ),
          ExperienceStep.preparing => PreparingScreen(
            key: ValueKey('preparing-$_pendingQr'),
            prepare: _prepareQr,
            onCancel: () => _goTo(ExperienceStep.scan),
            onComplete: () => _goTo(ExperienceStep.ready),
          ),
          ExperienceStep.ready => ReadyScreen(
            key: const ValueKey('ready'),
            audioEnabled: _audioEnabled,
            flashEnabled: _flashEnabled,
            audioAllowed: session?.manifest.audioAllowed ?? true,
            flashAllowed: session?.manifest.torchAllowed ?? true,
            eventTitle: session?.eventTitle ?? 'onePixel',
            organizationName:
                session?.manifest.brand?.organizationName ?? 'onePixel',
            brandColor: session?.manifest.brand?.primary,
            placeLabel: session == null
                ? strings.text(
                    'Settore · posto assegnato dal QR',
                    'Section · seat assigned by QR',
                  )
                : '${strings.text('Settore', 'Section')} ${session.manifest.zoneId}${session.manifest.seatId == null ? '' : ' · ${strings.text('Posto', 'Seat')} ${session.manifest.seatId}'}',
            onAudioChanged: (value) => setState(() => _audioEnabled = value),
            onFlashChanged: (value) => setState(() => _flashEnabled = value),
            onStart: _startShow,
            onChangeAccess: () => unawaited(_forgetAccess()),
          ),
          ExperienceStep.show => ShowScreen(
            key: const ValueKey('show'),
            session: session ?? _demoSession(),
            command: _command,
            connected: _connected,
            serverOffsetMs: _serverOffsetMs,
            audioEnabled: _audioEnabled,
            flashEnabled: _flashEnabled,
            onExit: () => _goTo(ExperienceStep.ready),
          ),
        },
      ),
    );
  }
}
