import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/features/event/preparing_screen.dart';
import 'package:onepixel/features/home/nearby_event_screen.dart';
import 'package:onepixel/main.dart';
import 'package:onepixel/widgets/pixel_mark.dart';

void main() {
  Future<void> setPhoneViewport(WidgetTester tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
  }

  testWidgets('il nome onePixel resta leggibile nel tema chiaro', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData.light(),
        home: const Scaffold(body: PixelMark()),
      ),
    );

    final name = tester.widget<Text>(find.text('onePixel'));
    expect(name.style?.color, ThemeData.light().colorScheme.onSurface);
  });

  testWidgets('parte senza account e mostra un evento vicino', (tester) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    expect(find.text('La tua luce\nserve qui.'), findsOneWidget);
    expect(find.text('Finale Luce'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Non serve registrarsi'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Non serve registrarsi'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsOneWidget);
    expect(find.text('Prova la coreografia demo'), findsOneWidget);
  });

  testWidgets('il QR centrale non copre alcuna voce della barra', (
    tester,
  ) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    expect(find.text('Scansiona'), findsNothing);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Profilo'), findsOneWidget);
    final scaffold = tester.widget<Scaffold>(find.byType(Scaffold).first);
    final bottomBar = tester.widget<BottomAppBar>(find.byType(BottomAppBar));
    expect(scaffold.extendBody, isTrue);
    expect(bottomBar.shape, isA<CircularNotchedRectangle>());
    expect(bottomBar.notchMargin, 12);
    await tester.tap(find.byTooltip('Scansiona il QR'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Inquadra il QR'), findsOneWidget);
  });

  testWidgets('apre lo scanner e prepara il pacchetto offline', (tester) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    await tester.tap(find.byTooltip('Scansiona il QR'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Inquadra il QR'), findsOneWidget);

    await tester.tap(find.text('Simula scansione'));
    await tester.pump();
    expect(find.text('Prepariamo\nil tuo pixel.'), findsOneWidget);
    expect(find.text('Timeline e colori'), findsOneWidget);

    await tester.pump(const Duration(seconds: 5));
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('Il tuo posto\nè pronto.'), findsOneWidget);
    expect(find.text('PRONTO OFFLINE'), findsOneWidget);
  });

  testWidgets('avvia la coreografia demo senza rete', (tester) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    await tester.ensureVisible(find.text('Prova la coreografia demo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Prova la coreografia demo'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Il tuo posto\nè pronto.'), findsOneWidget);
    expect(find.text('Audio sul telefono'), findsOneWidget);

    await tester.tap(find.text('Apri modalità spettacolo'));
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('INIZIAMO TRA'), findsOneWidget);
    expect(find.text('Tieni premuto per uscire'), findsOneWidget);
  });

  testWidgets('permette di cambiare evento o posto con conferma', (
    tester,
  ) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    await tester.ensureVisible(find.text('Prova la coreografia demo'));
    await tester.tap(find.text('Prova la coreografia demo'));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.ensureVisible(find.text('Cambia evento o posto'));
    await tester.tap(find.text('Cambia evento o posto'));
    await tester.pumpAndSettle();
    expect(find.text('Cambiare accesso?'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Cambia accesso'));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 10));
    expect(find.text('La tua luce\nserve qui.'), findsOneWidget);
  });

  testWidgets('la schermata pronta resta usabile su un telefono compatto', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    await tester.scrollUntilVisible(
      find.text('Prova la coreografia demo'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(find.text('Prova la coreografia demo'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('Cambia evento o posto'));
    expect(find.text('Apri modalità spettacolo'), findsOneWidget);
    expect(find.text('Cambia evento o posto'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ripete il download senza chiedere una nuova scansione', (
    tester,
  ) async {
    var attempts = 0;
    var completed = false;
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('it'),
        supportedLocales: const [Locale('it')],
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: PreparingScreen(
          prepare: () async {
            attempts += 1;
            if (attempts == 1) {
              throw const OnePixelApiException(
                'NETWORK_ERROR',
                'Connessione interrotta',
              );
            }
          },
          onCancel: () {},
          onComplete: () => completed = true,
        ),
      ),
    );

    await tester.pump();
    await tester.pump(const Duration(milliseconds: 10));
    expect(find.text('Connessione interrotta'), findsOneWidget);
    expect(find.text('Riprova'), findsOneWidget);
    await tester.ensureVisible(find.text('Riprova'));
    await tester.pump();
    await tester.tap(find.text('Riprova'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(attempts, 2);
    expect(completed, isTrue);
  });

  testWidgets('segue la lingua inglese del dispositivo', (tester) async {
    await setPhoneViewport(tester);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('en')),
    );
    expect(find.text('Your light\nis needed here.'), findsOneWidget);
    expect(find.byTooltip('Scan the QR'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('No registration needed'),
      180,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('No registration needed'), findsOneWidget);
  });

  testWidgets('resta usabile su un telefono Android compatto', (tester) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const OnePixelApp(testMode: true, locale: Locale('it')),
    );

    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Profilo'));
    await tester.pumpAndSettle();
    expect(find.text('Il tuo onePixel.'), findsOneWidget);
    expect(find.text('Continua con Google'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Apri notifiche'));
    await tester.pumpAndSettle();
    expect(find.text('CENTRO ATTIVITÀ'), findsOneWidget);
    expect(find.text('Notifiche'), findsWidgets);
    expect(tester.takeException(), isNull);
  });

  testWidgets('aggiorna la ricerca eventi con il gesto pull-to-refresh', (
    tester,
  ) async {
    var refreshes = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: NearbyEventScreen(
          onEnter: () {},
          onDemo: () {},
          onRefresh: () async {
            refreshes += 1;
          },
          testMode: true,
        ),
      ),
    );
    await tester.drag(find.byType(ListView).first, const Offset(0, 420));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(refreshes, 1);
  });
}
