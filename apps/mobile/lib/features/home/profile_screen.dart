import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/core/theme/app_theme.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.api,
    required this.token,
    required this.profile,
    required this.themeMode,
    required this.locale,
    required this.onAuthenticated,
    required this.onProfileUpdated,
    required this.onSignOut,
    required this.onThemeChanged,
    required this.onLocaleChanged,
  });

  final OnePixelApiClient api;
  final String? token;
  final ParticipantProfile? profile;
  final ThemeMode themeMode;
  final Locale? locale;
  final ValueChanged<ParticipantAuthResult> onAuthenticated;
  final ValueChanged<ParticipantProfile> onProfileUpdated;
  final VoidCallback onSignOut;
  final ValueChanged<ThemeMode> onThemeChanged;
  final ValueChanged<Locale> onLocaleChanged;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  static Future<void>? _googleInitialization;
  bool register = false;
  bool pending = false;
  String? error;
  Future<List<Map<String, dynamic>>>? _events;
  final name = TextEditingController();
  final email = TextEditingController();
  final password = TextEditingController();

  @override
  void initState() {
    super.initState();
    _refreshEvents();
  }

  @override
  void didUpdateWidget(covariant ProfileScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.token != oldWidget.token) _refreshEvents();
  }

  void _refreshEvents() {
    _events = widget.token == null
        ? null
        : widget.api.participantEvents(widget.token!);
  }

  @override
  void dispose() {
    name.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final strings = AppStrings.of(context);
    final normalizedEmail = email.text.trim();
    final validEmail = RegExp(
      r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
    ).hasMatch(normalizedEmail);
    if (!validEmail) {
      setState(
        () => error = strings.text(
          'Inserisci un indirizzo email valido.',
          'Enter a valid email address.',
        ),
      );
      return;
    }
    if (password.text.length < (register ? 10 : 8)) {
      setState(
        () => error = register
            ? strings.text(
                'La password deve avere almeno 10 caratteri.',
                'The password must be at least 10 characters.',
              )
            : strings.text(
                'La password deve avere almeno 8 caratteri.',
                'The password must be at least 8 characters.',
              ),
      );
      return;
    }
    if (register && name.text.trim().length < 2) {
      setState(
        () =>
            error = strings.text('Inserisci il tuo nome.', 'Enter your name.'),
      );
      return;
    }
    setState(() {
      pending = true;
      error = null;
    });
    try {
      final result = register
          ? await widget.api.participantRegister(
              name: name.text.trim(),
              email: normalizedEmail,
              password: password.text,
            )
          : await widget.api.participantLogin(
              email: normalizedEmail,
              password: password.text,
            );
      widget.onAuthenticated(result);
    } on OnePixelApiException catch (caught) {
      if (mounted) setState(() => error = caught.message);
    } on Object {
      if (mounted) {
        setState(
          () => error = strings.text(
            'Connessione non disponibile. Controlla Internet e riprova.',
            'No connection. Check your Internet connection and try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> google() async {
    final strings = AppStrings.of(context);
    setState(() {
      pending = true;
      error = null;
    });
    try {
      const clientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
      _googleInitialization ??= GoogleSignIn.instance.initialize(
        serverClientId: clientId.isEmpty ? null : clientId,
      );
      await _googleInitialization;
      if (!GoogleSignIn.instance.supportsAuthenticate()) {
        throw Exception(
          strings.text(
            'Accesso Google non disponibile su questo dispositivo',
            'Google sign-in is unavailable on this device',
          ),
        );
      }
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      if (idToken == null) {
        throw Exception(
          strings.text(
            'Google non ha completato l’accesso',
            'Google did not complete sign-in',
          ),
        );
      }
      widget.onAuthenticated(await widget.api.participantGoogle(idToken));
    } on GoogleSignInException catch (caught) {
      if (mounted) {
        setState(
          () => error = caught.code == GoogleSignInExceptionCode.canceled
              ? strings.text(
                  'Accesso Google annullato',
                  'Google sign-in canceled',
                )
              : strings.text(
                  'Accesso Google non disponibile. Usa email e password.',
                  'Google sign-in is unavailable. Use email and password.',
                ),
        );
      }
    } on OnePixelApiException catch (caught) {
      if (mounted) setState(() => error = caught.message);
    } on Object catch (caught) {
      if (mounted) setState(() => error = caught.toString());
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  Future<void> _editProfile() async {
    final profile = widget.profile;
    final token = widget.token;
    if (profile == null || token == null) return;
    final editName = TextEditingController(text: profile.name);
    final editAvatar = TextEditingController(text: profile.avatarUrl ?? '');
    final result = await showModalBottomSheet<(String, String?)>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          20,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AppStrings.of(context).text('Modifica profilo', 'Edit profile'),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 18),
            TextField(
              controller: editName,
              textCapitalization: TextCapitalization.words,
              decoration: _inputDecoration(
                AppStrings.of(context).text('Nome', 'Name'),
                Icons.badge_outlined,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: editAvatar,
              keyboardType: TextInputType.url,
              decoration: _inputDecoration(
                AppStrings.of(
                  context,
                ).text('URL foto facoltativa', 'Optional photo URL'),
                Icons.photo_camera_outlined,
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.pop(context, (
                editName.text.trim(),
                editAvatar.text.trim().isEmpty ? null : editAvatar.text.trim(),
              )),
              child: Text(
                AppStrings.of(context).text('Salva profilo', 'Save profile'),
              ),
            ),
          ],
        ),
      ),
    );
    editName.dispose();
    editAvatar.dispose();
    if (result == null) return;
    final avatarUri = result.$2 == null ? null : Uri.tryParse(result.$2!);
    if (result.$1.length < 2 ||
        (avatarUri != null &&
            avatarUri.scheme != 'http' &&
            avatarUri.scheme != 'https')) {
      if (mounted) {
        setState(
          () => error = AppStrings.of(context).text(
            'Inserisci un nome e, se presente, un link foto http o https valido.',
            'Enter a name and, if provided, a valid http or https photo link.',
          ),
        );
      }
      return;
    }
    setState(() {
      pending = true;
      error = null;
    });
    try {
      final updated = await widget.api.updateParticipant(
        token: token,
        name: result.$1,
        avatarUrl: result.$2,
        locale: widget.locale?.languageCode ?? 'it',
        theme: widget.themeMode.name,
      );
      widget.onProfileUpdated(updated);
    } on OnePixelApiException catch (caught) {
      if (mounted) setState(() => error = caught.message);
    } on Object {
      if (mounted) {
        setState(
          () => error = AppStrings.of(context).text(
            'Impossibile salvare ora. Controlla Internet e riprova.',
            'Unable to save now. Check your Internet connection and try again.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    final profile = widget.profile;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 100),
        children: [
          Text(
            strings.text('PROFILO E IMPOSTAZIONI', 'PROFILE & SETTINGS'),
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: 8),
          Text(
            strings.text('Il tuo onePixel.', 'Your onePixel.'),
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 22),
          if (widget.token == null || profile == null)
            _AuthCard(
              register: register,
              pending: pending,
              error: error,
              name: name,
              email: email,
              password: password,
              onToggle: () => setState(() => register = !register),
              onSubmit: submit,
              onGoogle: google,
            )
          else ...[
            _ProfileCard(
              profile: profile,
              pending: pending,
              onEdit: _editProfile,
              onSignOut: widget.onSignOut,
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 10),
                child: Text(
                  error!,
                  style: const TextStyle(
                    color: OnePixelColors.coral,
                    fontSize: 11,
                  ),
                ),
              ),
            const SizedBox(height: 18),
            Text(
              strings.text('I TUOI EVENTI', 'YOUR EVENTS'),
              style: Theme.of(context).textTheme.labelSmall,
            ),
            const SizedBox(height: 10),
            FutureBuilder<List<Map<String, dynamic>>>(
              future: _events,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const _LoadingEvents();
                }
                if (snapshot.hasError) {
                  return _EventsError(
                    strings: strings,
                    onRetry: () => setState(_refreshEvents),
                  );
                }
                final events = snapshot.data ?? const [];
                if (events.isEmpty) return _EmptyEvents(strings: strings);
                return Column(
                  children: events
                      .map(
                        (event) => Padding(
                          padding: const EdgeInsets.only(bottom: 9),
                          child: _HistoryTile(event: event),
                        ),
                      )
                      .toList(),
                );
              },
            ),
          ],
          const SizedBox(height: 22),
          Text(
            strings.text('ASPETTO', 'APPEARANCE'),
            style: Theme.of(context).textTheme.labelSmall,
          ),
          const SizedBox(height: 10),
          _ChoicePanel(
            children: [
              _ChoiceButton(
                icon: Icons.auto_awesome_rounded,
                label: strings.text('Sistema', 'System'),
                active: widget.themeMode == ThemeMode.system,
                onTap: () => widget.onThemeChanged(ThemeMode.system),
              ),
              _ChoiceButton(
                icon: Icons.light_mode_outlined,
                label: strings.text('Chiaro', 'Light'),
                active: widget.themeMode == ThemeMode.light,
                onTap: () => widget.onThemeChanged(ThemeMode.light),
              ),
              _ChoiceButton(
                icon: Icons.dark_mode_outlined,
                label: strings.text('Scuro', 'Dark'),
                active: widget.themeMode == ThemeMode.dark,
                onTap: () => widget.onThemeChanged(ThemeMode.dark),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ChoicePanel(
            children: [
              _ChoiceButton(
                icon: Icons.language_rounded,
                label: 'Italiano',
                active:
                    (widget.locale?.languageCode ??
                        Localizations.localeOf(context).languageCode) ==
                    'it',
                onTap: () => widget.onLocaleChanged(const Locale('it')),
              ),
              _ChoiceButton(
                icon: Icons.language_rounded,
                label: 'English',
                active:
                    (widget.locale?.languageCode ??
                        Localizations.localeOf(context).languageCode) ==
                    'en',
                onTap: () => widget.onLocaleChanged(const Locale('en')),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: _panel(context),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined, color: OnePixelColors.teal),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    strings.text(
                      'L’account è facoltativo: QR, GPS e coreografia funzionano anche senza registrazione.',
                      'Your account is optional: QR, GPS and choreography work without registration.',
                    ),
                    style: Theme.of(
                      context,
                    ).textTheme.bodyMedium?.copyWith(fontSize: 11),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

InputDecoration _inputDecoration(String label, IconData icon) =>
    InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon),
      filled: true,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
    );
BoxDecoration _panel(BuildContext context) => BoxDecoration(
  color: Theme.of(context).colorScheme.surface,
  borderRadius: BorderRadius.circular(24),
  border: Border.all(
    color: Theme.of(context).dividerColor.withValues(alpha: .14),
  ),
);

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.profile,
    required this.pending,
    required this.onEdit,
    required this.onSignOut,
  });
  final ParticipantProfile profile;
  final bool pending;
  final VoidCallback onEdit;
  final VoidCallback onSignOut;
  @override
  Widget build(BuildContext context) {
    final initials = profile.name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0].toUpperCase())
        .join();
    final fallback = Center(
      child: Text(
        initials,
        style: const TextStyle(fontWeight: FontWeight.w800),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: _panel(context),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 30,
                backgroundColor: OnePixelColors.signal,
                foregroundColor: OnePixelColors.ink,
                child: profile.avatarUrl == null
                    ? fallback
                    : ClipOval(
                        child: Image.network(
                          profile.avatarUrl!,
                          width: 60,
                          height: 60,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) =>
                              fallback,
                        ),
                      ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      profile.name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      profile.email,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.bodyMedium?.copyWith(fontSize: 11),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: pending ? null : onSignOut,
                tooltip: 'Logout',
                icon: const Icon(Icons.logout_rounded),
              ),
            ],
          ),
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: pending ? null : onEdit,
            icon: const Icon(Icons.edit_outlined, size: 17),
            label: Text(
              AppStrings.of(
                context,
              ).text('Modifica nome e foto', 'Edit name and photo'),
            ),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(44),
              shape: const StadiumBorder(),
            ),
          ),
        ],
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.event});
  final Map<String, dynamic> event;
  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(event['starts_at']?.toString() ?? '');
    final dateLabel = date == null
        ? ''
        : '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
    final hasTicket = event['ticket_token'] != null;
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: _panel(context),
      child: Row(
        children: [
          Container(
            width: 45,
            height: 45,
            decoration: BoxDecoration(
              color: OnePixelColors.signal.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(15),
            ),
            child: Icon(
              hasTicket
                  ? Icons.confirmation_number_rounded
                  : Icons.event_outlined,
              color: OnePixelColors.signal,
              size: 21,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event['title']?.toString() ?? 'onePixel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${event['venue_name'] ?? ''}${dateLabel.isEmpty ? '' : ' · $dateLabel'}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontSize: 9),
                ),
              ],
            ),
          ),
          if (event['saved'] == true)
            const Icon(
              Icons.bookmark_rounded,
              color: OnePixelColors.signal,
              size: 18,
            ),
        ],
      ),
    );
  }
}

class _LoadingEvents extends StatelessWidget {
  const _LoadingEvents();
  @override
  Widget build(BuildContext context) => Container(
    height: 76,
    alignment: Alignment.center,
    decoration: _panel(context),
    child: const SizedBox(
      width: 22,
      height: 22,
      child: CircularProgressIndicator(strokeWidth: 2),
    ),
  );
}

class _EmptyEvents extends StatelessWidget {
  const _EmptyEvents({required this.strings});
  final AppStrings strings;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: _panel(context),
    child: Row(
      children: [
        const Icon(
          Icons.confirmation_number_outlined,
          color: OnePixelColors.signal,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            strings.text(
              'Qui troverai eventi salvati, passati e biglietti QR.',
              'Saved events, history and QR tickets will appear here.',
            ),
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontSize: 11),
          ),
        ),
      ],
    ),
  );
}

class _EventsError extends StatelessWidget {
  const _EventsError({required this.strings, required this.onRetry});
  final AppStrings strings;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: _panel(context),
    child: Column(
      children: [
        const Icon(Icons.cloud_off_rounded, color: OnePixelColors.coral),
        const SizedBox(height: 10),
        Text(
          strings.text(
            'Impossibile caricare gli eventi.',
            'Unable to load events.',
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        TextButton.icon(
          onPressed: onRetry,
          icon: const Icon(Icons.refresh_rounded),
          label: Text(strings.text('Riprova', 'Try again')),
        ),
      ],
    ),
  );
}

class _ChoicePanel extends StatelessWidget {
  const _ChoicePanel({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(5),
    decoration: _panel(context),
    child: Row(
      children: children.map((child) => Expanded(child: child)).toList(),
    ),
  );
}

class _ChoiceButton extends StatelessWidget {
  const _ChoiceButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: active ? OnePixelColors.signal : Colors.transparent,
    borderRadius: BorderRadius.circular(18),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 54),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: 17,
                color: active ? OnePixelColors.ink : OnePixelColors.muted,
              ),
              const SizedBox(height: 4),
              FittedBox(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    color: active ? OnePixelColors.ink : OnePixelColors.muted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _AuthCard extends StatelessWidget {
  const _AuthCard({
    required this.register,
    required this.pending,
    required this.error,
    required this.name,
    required this.email,
    required this.password,
    required this.onToggle,
    required this.onSubmit,
    required this.onGoogle,
  });
  final bool register;
  final bool pending;
  final String? error;
  final TextEditingController name;
  final TextEditingController email;
  final TextEditingController password;
  final VoidCallback onToggle;
  final VoidCallback onSubmit;
  final VoidCallback onGoogle;
  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panel(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            register
                ? Icons.person_add_alt_1_rounded
                : Icons.person_outline_rounded,
            color: OnePixelColors.signal,
            size: 28,
          ),
          const SizedBox(height: 14),
          Text(
            register
                ? strings.text('Crea il tuo profilo', 'Create your profile')
                : strings.text('Accedi quando vuoi', 'Sign in when you want'),
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            strings.text(
              'Salva eventi, biglietti, nome e foto.',
              'Save events, tickets, name and photo.',
            ),
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontSize: 12),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: pending ? null : onGoogle,
            icon: const Text(
              'G',
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w900,
                color: OnePixelColors.signal,
              ),
            ),
            label: Text(
              strings.text('Continua con Google', 'Continue with Google'),
            ),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(50),
              shape: const StadiumBorder(),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 13),
            child: Row(
              children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: Text(
                    strings.text('OPPURE', 'OR'),
                    style: const TextStyle(
                      fontSize: 8,
                      color: OnePixelColors.muted,
                    ),
                  ),
                ),
                const Expanded(child: Divider()),
              ],
            ),
          ),
          if (register) ...[
            TextField(
              controller: name,
              decoration: _inputDecoration(
                strings.text('Nome', 'Name'),
                Icons.badge_outlined,
              ),
            ),
            const SizedBox(height: 10),
          ],
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: _inputDecoration(
              'Email',
              Icons.alternate_email_rounded,
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: password,
            obscureText: true,
            enableSuggestions: false,
            autocorrect: false,
            textInputAction: TextInputAction.done,
            onSubmitted: pending ? null : (_) => onSubmit(),
            decoration: _inputDecoration(
              'Password',
              Icons.lock_outline_rounded,
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Text(
                error!,
                style: const TextStyle(
                  color: OnePixelColors.coral,
                  fontSize: 11,
                ),
              ),
            ),
          const SizedBox(height: 15),
          if (register) ...[
            Text(
              strings.text(
                'Usa almeno 10 caratteri.',
                'Use at least 10 characters.',
              ),
              style: const TextStyle(color: OnePixelColors.muted, fontSize: 10),
            ),
            const SizedBox(height: 8),
          ],
          FilledButton(
            onPressed: pending ? null : onSubmit,
            child: Text(
              pending
                  ? strings.text('Attendi…', 'Please wait…')
                  : register
                  ? strings.text('Registrati', 'Register')
                  : strings.text('Accedi', 'Sign in'),
            ),
          ),
          TextButton(
            onPressed: onToggle,
            child: Text(
              register
                  ? strings.text(
                      'Ho già un account',
                      'I already have an account',
                    )
                  : strings.text(
                      'Crea un account facoltativo',
                      'Create an optional account',
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
