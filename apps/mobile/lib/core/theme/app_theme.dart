import 'package:flutter/material.dart';

abstract final class OnePixelColors {
  static const ink = Color(0xFF0B0D0E);
  static const inkSoft = Color(0xFF15191B);
  static const panel = Color(0xFF1B2022);
  static const line = Color(0xFF303739);
  static const paper = Color(0xFFF2F3ED);
  static const muted = Color(0xFF9BA3A2);
  static const signal = Color(0xFFD1E66A);
  static const amber = Color(0xFFE2A65A);
  static const teal = Color(0xFF77A4A1);
  static const coral = Color(0xFFD17667);
}

abstract final class OnePixelTheme {
  static ThemeData get dark {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: OnePixelColors.signal,
          brightness: Brightness.dark,
          surface: OnePixelColors.inkSoft,
        ).copyWith(
          primary: OnePixelColors.signal,
          onPrimary: OnePixelColors.ink,
          surface: OnePixelColors.inkSoft,
          onSurface: OnePixelColors.paper,
          outline: OnePixelColors.line,
        );

    return ThemeData(
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: OnePixelColors.ink,
      useMaterial3: true,
      splashFactory: InkSparkle.splashFactory,
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          color: OnePixelColors.paper,
          fontSize: 52,
          height: .92,
          fontWeight: FontWeight.w700,
          letterSpacing: -2.8,
        ),
        displayMedium: TextStyle(
          color: OnePixelColors.paper,
          fontSize: 40,
          height: .96,
          fontWeight: FontWeight.w700,
          letterSpacing: -2,
        ),
        headlineSmall: TextStyle(
          color: OnePixelColors.paper,
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: -.7,
        ),
        bodyLarge: TextStyle(
          color: OnePixelColors.paper,
          fontSize: 16,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          color: OnePixelColors.muted,
          fontSize: 14,
          height: 1.5,
        ),
        labelSmall: TextStyle(
          color: OnePixelColors.signal,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.8,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: OnePixelColors.signal,
          foregroundColor: OnePixelColors.ink,
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            letterSpacing: -.2,
          ),
          shape: const StadiumBorder(),
        ),
      ),
    );
  }

  static ThemeData get light {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: const Color(0xFF82952D),
          brightness: Brightness.light,
          surface: const Color(0xFFF4F5EE),
        ).copyWith(
          primary: const Color(0xFF687D12),
          onPrimary: Colors.white,
          surface: const Color(0xFFF4F5EE),
          onSurface: const Color(0xFF15191B),
          outline: const Color(0xFFD3D8D0),
        );
    return ThemeData(
      brightness: Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: const Color(0xFFF4F5EE),
      useMaterial3: true,
      splashFactory: InkSparkle.splashFactory,
      textTheme: const TextTheme(
        displayLarge: TextStyle(
          color: Color(0xFF15191B),
          fontSize: 52,
          height: .92,
          fontWeight: FontWeight.w700,
          letterSpacing: -2.8,
        ),
        displayMedium: TextStyle(
          color: Color(0xFF15191B),
          fontSize: 40,
          height: .96,
          fontWeight: FontWeight.w700,
          letterSpacing: -2,
        ),
        headlineSmall: TextStyle(
          color: Color(0xFF15191B),
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: -.7,
        ),
        bodyLarge: TextStyle(
          color: Color(0xFF15191B),
          fontSize: 16,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          color: Color(0xFF5E6865),
          fontSize: 14,
          height: 1.5,
        ),
        labelSmall: TextStyle(
          color: Color(0xFF687D12),
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.8,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(56),
          backgroundColor: const Color(0xFF687D12),
          foregroundColor: Colors.white,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          shape: const StadiumBorder(),
        ),
      ),
    );
  }
}
