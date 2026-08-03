import 'dart:convert';

import 'package:crypto/crypto.dart';

class NearbyEvent {
  const NearbyEvent({
    required this.id,
    required this.title,
    required this.venueName,
    required this.startsAt,
    required this.distanceM,
    this.kind = 'other',
    this.status = 'published',
    this.locationName = '',
    this.coverUrl,
    this.organizationName = 'onePixel',
    this.latitude,
    this.longitude,
    this.accessMethods = const ['qr'],
  });

  factory NearbyEvent.fromJson(Map<String, dynamic> json) => NearbyEvent(
    id: json['id'] as String,
    title: json['title'] as String,
    venueName: json['venue_name'] as String,
    startsAt: DateTime.parse(json['starts_at'] as String),
    distanceM: (json['distanceM'] as num).round(),
    kind: json['kind'] as String? ?? 'other',
    status: json['status'] as String? ?? 'published',
    locationName: json['location_name'] as String? ?? '',
    coverUrl: json['cover_url'] as String?,
    organizationName: json['organization_name'] as String? ?? 'onePixel',
    latitude: (json['latitude'] as num?)?.toDouble(),
    longitude: (json['longitude'] as num?)?.toDouble(),
    accessMethods:
        ((json['access_policy'] as Map?)?['methods'] as List?)
            ?.cast<String>() ??
        const ['qr'],
  );

  final String id;
  final String title;
  final String venueName;
  final DateTime startsAt;
  final int distanceM;
  final String kind;
  final String status;
  final String locationName;
  final String? coverUrl;
  final String organizationName;
  final double? latitude;
  final double? longitude;
  final List<String> accessMethods;
}

class ParticipantProfile {
  const ParticipantProfile({
    required this.id,
    required this.email,
    required this.name,
    this.avatarUrl,
    this.locale = 'it',
    this.theme = 'system',
  });
  factory ParticipantProfile.fromJson(Map<String, dynamic> json) =>
      ParticipantProfile(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
        avatarUrl: json['avatarUrl'] as String?,
        locale: json['locale'] as String? ?? 'it',
        theme: json['theme'] as String? ?? 'system',
      );
  final String id;
  final String email;
  final String name;
  final String? avatarUrl;
  final String locale;
  final String theme;
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.kind,
    required this.titleIt,
    required this.titleEn,
    required this.bodyIt,
    required this.bodyEn,
    required this.createdAt,
    this.eventId,
    this.readAt,
  });
  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id'] as String,
        eventId: json['event_id'] as String?,
        kind: json['kind'] as String,
        titleIt: json['title_it'] as String,
        titleEn: json['title_en'] as String,
        bodyIt: json['body_it'] as String,
        bodyEn: json['body_en'] as String,
        createdAt: DateTime.parse(json['created_at'] as String),
        readAt: json['read_at'] == null
            ? null
            : DateTime.parse(json['read_at'] as String),
      );
  final String id;
  final String? eventId;
  final String kind;
  final String titleIt;
  final String titleEn;
  final String bodyIt;
  final String bodyEn;
  final DateTime createdAt;
  final DateTime? readAt;
}

class TimelineCue {
  const TimelineCue({
    required this.id,
    required this.atMs,
    required this.durationMs,
    required this.zones,
    this.color,
    this.text,
    this.audioAsset,
    this.vibration,
    this.torch,
  });

  factory TimelineCue.fromJson(Map<String, dynamic> json) => TimelineCue(
    id: json['id'] as String,
    atMs: (json['atMs'] as num).round(),
    durationMs: (json['durationMs'] as num).round(),
    zones: (json['zones'] as List).cast<String>(),
    color: json['color'] as String?,
    text: (json['text'] as Map?)?.cast<String, dynamic>(),
    audioAsset: json['audioAsset'] as String?,
    vibration: (json['vibration'] as List?)
        ?.cast<num>()
        .map((value) => value.round())
        .toList(),
    torch: json['torch'] as bool?,
  );

  final String id;
  final int atMs;
  final int durationMs;
  final List<String> zones;
  final String? color;
  final Map<String, dynamic>? text;
  final String? audioAsset;
  final List<int>? vibration;
  final bool? torch;

  Map<String, dynamic> toJson() => {
    'id': id,
    'atMs': atMs,
    'durationMs': durationMs,
    'zones': zones,
    if (color != null) 'color': color,
    if (text != null) 'text': text,
    if (audioAsset != null) 'audioAsset': audioAsset,
    if (vibration != null) 'vibration': vibration,
    if (torch != null) 'torch': torch,
  };
}

class PackageAsset {
  const PackageAsset({
    required this.url,
    required this.sha256,
    required this.bytes,
    required this.mimeType,
  });

  factory PackageAsset.fromJson(Map<String, dynamic> json) => PackageAsset(
    url: json['url'] as String,
    sha256: json['sha256'] as String,
    bytes: (json['bytes'] as num).round(),
    mimeType: json['mimeType'] as String,
  );

  final String url;
  final String sha256;
  final int bytes;
  final String mimeType;

  Map<String, dynamic> toJson() => {
    'url': url,
    'sha256': sha256,
    'bytes': bytes,
    'mimeType': mimeType,
  };
}

class EventBrand {
  const EventBrand({
    required this.organizationName,
    required this.primary,
    this.logo,
  });

  factory EventBrand.fromJson(Map<String, dynamic> json) => EventBrand(
    organizationName: json['organizationName'] as String,
    primary: json['primary'] as String,
    logo: json['logo'] as String?,
  );

  final String organizationName;
  final String primary;
  final String? logo;

  Map<String, dynamic> toJson() => {
    'organizationName': organizationName,
    'primary': primary,
    'logo': logo,
  };
}

class OfflineManifest {
  const OfflineManifest({
    required this.protocolVersion,
    required this.eventId,
    required this.version,
    required this.startsAt,
    required this.serverTime,
    required this.zoneId,
    required this.audioAllowed,
    required this.torchAllowed,
    required this.checksum,
    required this.cues,
    required this.assets,
    this.seatId,
    this.brand,
  });

  factory OfflineManifest.fromJson(Map<String, dynamic> json) =>
      OfflineManifest(
        protocolVersion: (json['protocolVersion'] as num).round(),
        eventId: json['eventId'] as String,
        version: (json['version'] as num).round(),
        startsAt: DateTime.parse(json['startsAt'] as String),
        serverTime: DateTime.parse(json['serverTime'] as String),
        zoneId: json['zoneId'] as String,
        seatId: json['seatId'] as String?,
        audioAllowed: json['audioAllowed'] as bool,
        torchAllowed: json['torchAllowed'] as bool,
        brand: json['brand'] == null
            ? null
            : EventBrand.fromJson(
                (json['brand'] as Map).cast<String, dynamic>(),
              ),
        checksum: json['checksum'] as String,
        cues: (json['cues'] as List)
            .map(
              (value) =>
                  TimelineCue.fromJson((value as Map).cast<String, dynamic>()),
            )
            .toList(),
        assets: (json['assets'] as List)
            .map(
              (value) =>
                  PackageAsset.fromJson((value as Map).cast<String, dynamic>()),
            )
            .toList(),
      );

  final int protocolVersion;
  final String eventId;
  final int version;
  final DateTime startsAt;
  final DateTime serverTime;
  final String zoneId;
  final String? seatId;
  final bool audioAllowed;
  final bool torchAllowed;
  final EventBrand? brand;
  final String checksum;
  final List<TimelineCue> cues;
  final List<PackageAsset> assets;

  Map<String, dynamic> checksumPayload() => {
    'protocolVersion': protocolVersion,
    'eventId': eventId,
    'version': version,
    'startsAt': startsAt.toUtc().toIso8601String(),
    'zoneId': zoneId,
    if (seatId != null) 'seatId': seatId,
    'audioAllowed': audioAllowed,
    'torchAllowed': torchAllowed,
    if (brand != null) 'brand': brand!.toJson(),
    'cues': cues.map((cue) => cue.toJson()).toList(),
    'assets': assets.map((asset) => asset.toJson()).toList(),
  };

  bool get hasValidChecksum =>
      sha256
          .convert(utf8.encode(_canonicalJson(checksumPayload())))
          .toString() ==
      checksum;

  Map<String, dynamic> toJson() => {
    ...checksumPayload(),
    'serverTime': serverTime.toUtc().toIso8601String(),
    'checksum': checksum,
  };
}

String _canonicalJson(Object? value) {
  if (value == null || value is num || value is bool || value is String) {
    return jsonEncode(value);
  }
  if (value is List) return '[${value.map(_canonicalJson).join(',')}]';
  if (value is Map) {
    final keys = value.keys.cast<String>().toList()..sort();
    return '{${keys.map((key) => '${jsonEncode(key)}:${_canonicalJson(value[key])}').join(',')}}';
  }
  throw ArgumentError('Unsupported canonical JSON value ${value.runtimeType}');
}

class JoinSession {
  const JoinSession({
    required this.sessionId,
    required this.token,
    required this.eventTitle,
    required this.realtimeUrl,
    required this.manifest,
    this.localAssets = const {},
  });

  factory JoinSession.fromJson(Map<String, dynamic> json) => JoinSession(
    sessionId: json['sessionId'] as String,
    token: json['token'] as String,
    eventTitle: json['eventTitle'] as String,
    realtimeUrl: json['realtimeUrl'] as String,
    manifest: OfflineManifest.fromJson(
      (json['manifest'] as Map).cast<String, dynamic>(),
    ),
    localAssets: (json['localAssets'] as Map? ?? {}).cast<String, String>(),
  );

  final String sessionId;
  final String token;
  final String eventTitle;
  final String realtimeUrl;
  final OfflineManifest manifest;
  final Map<String, String> localAssets;

  JoinSession copyWith({Map<String, String>? localAssets}) => JoinSession(
    sessionId: sessionId,
    token: token,
    eventTitle: eventTitle,
    realtimeUrl: realtimeUrl,
    manifest: manifest,
    localAssets: localAssets ?? this.localAssets,
  );

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'token': token,
    'eventTitle': eventTitle,
    'realtimeUrl': realtimeUrl,
    'manifest': manifest.toJson(),
    'localAssets': localAssets,
  };
}

class LiveCommand {
  const LiveCommand({
    required this.sequence,
    required this.type,
    required this.executeAt,
    this.cue,
    this.reason,
  });

  factory LiveCommand.fromJson(Map<String, dynamic> json) => LiveCommand(
    sequence: (json['sequence'] as num).round(),
    type: json['type'] as String,
    executeAt: DateTime.parse(json['executeAt'] as String),
    cue: json['cue'] == null
        ? null
        : TimelineCue.fromJson((json['cue'] as Map).cast<String, dynamic>()),
    reason: json['reason'] as String?,
  );

  final int sequence;
  final String type;
  final DateTime executeAt;
  final TimelineCue? cue;
  final String? reason;
}
