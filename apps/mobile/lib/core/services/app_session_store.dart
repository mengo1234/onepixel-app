import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

class AppSessionSettings {
  const AppSessionSettings({
    required this.installationId,
    this.participantToken,
    this.themeMode = ThemeMode.dark,
    this.locale,
  });
  final String installationId;
  final String? participantToken;
  final ThemeMode themeMode;
  final Locale? locale;
}

class AppSessionStore {
  static const _installationKey = 'onepixel.installation_id';
  static const _participantTokenKey = 'onepixel.participant_token';
  static const _themeKey = 'onepixel.theme';
  static const _localeKey = 'onepixel.locale';

  Future<AppSessionSettings> load() async {
    final preferences = await SharedPreferences.getInstance();
    var installationId = preferences.getString(_installationKey);
    if (installationId == null) {
      installationId = const Uuid().v4();
      await preferences.setString(_installationKey, installationId);
    }
    final themeName = preferences.getString(_themeKey) ?? 'dark';
    final language = preferences.getString(_localeKey);
    return AppSessionSettings(
      installationId: installationId,
      participantToken: preferences.getString(_participantTokenKey),
      themeMode: switch (themeName) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      },
      locale: language == null ? null : Locale(language),
    );
  }

  Future<void> saveParticipantToken(String? token) async {
    final preferences = await SharedPreferences.getInstance();
    if (token == null) {
      await preferences.remove(_participantTokenKey);
    } else {
      await preferences.setString(_participantTokenKey, token);
    }
  }

  Future<void> saveTheme(ThemeMode mode) async =>
      (await SharedPreferences.getInstance()).setString(_themeKey, mode.name);
  Future<void> saveLocale(Locale locale) async =>
      (await SharedPreferences.getInstance()).setString(
        _localeKey,
        locale.languageCode,
      );
}
