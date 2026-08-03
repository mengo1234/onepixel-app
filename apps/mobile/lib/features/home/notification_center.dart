import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:onepixel/core/localization/app_strings.dart';
import 'package:onepixel/core/models/event_models.dart';
import 'package:onepixel/core/services/api_client.dart';
import 'package:onepixel/core/theme/app_theme.dart';

class NotificationCenter extends StatefulWidget {
  const NotificationCenter({
    super.key,
    required this.api,
    required this.installationId,
  });

  final OnePixelApiClient api;
  final String installationId;

  @override
  State<NotificationCenter> createState() => _NotificationCenterState();
}

class _NotificationCenterState extends State<NotificationCenter> {
  late Future<List<AppNotification>> _future;
  final Set<String> _markingRead = {};

  @override
  void initState() {
    super.initState();
    _future = widget.api.notifications(widget.installationId);
  }

  @override
  void didUpdateWidget(covariant NotificationCenter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.installationId != oldWidget.installationId) _reload();
  }

  void _reload() {
    setState(() {
      _future = widget.api.notifications(widget.installationId);
    });
  }

  Future<void> _markRead(AppNotification notification) async {
    if (_markingRead.contains(notification.id)) return;
    setState(() => _markingRead.add(notification.id));
    try {
      await widget.api.markNotificationRead(
        widget.installationId,
        notification.id,
      );
      if (mounted) _reload();
    } on Object {
      if (!mounted) return;
      final strings = AppStrings.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            strings.text(
              'Non riesco a segnare la notifica come letta. Riprova.',
              'Unable to mark the notification as read. Try again.',
            ),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _markingRead.remove(notification.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      strings.text('CENTRO ATTIVITÀ', 'ACTIVITY CENTER'),
                      style: Theme.of(context).textTheme.labelSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      strings.text('Notifiche', 'Notifications'),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                  ],
                ),
                IconButton.filledTonal(
                  onPressed: _reload,
                  tooltip: strings.text('Aggiorna', 'Refresh'),
                  icon: const Icon(Icons.refresh_rounded),
                ),
              ],
            ),
            const SizedBox(height: 22),
            Expanded(
              child: FutureBuilder<List<AppNotification>>(
                future: _future,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(
                      child: CircularProgressIndicator(
                        color: OnePixelColors.signal,
                      ),
                    );
                  }
                  if (snapshot.hasError) {
                    return _Empty(
                      icon: Icons.cloud_off_rounded,
                      title: strings.text(
                        'Notifiche non disponibili',
                        'Notifications unavailable',
                      ),
                      body: strings.text(
                        'Controlla la connessione e riprova.',
                        'Check your connection and try again.',
                      ),
                      actionLabel: strings.text('Riprova', 'Try again'),
                      onAction: _reload,
                    );
                  }
                  final notifications = snapshot.data ?? const [];
                  if (notifications.isEmpty) {
                    return _Empty(
                      icon: Icons.notifications_none_rounded,
                      title: strings.text('Tutto tranquillo', 'All quiet'),
                      body: strings.text(
                        'Qui troverai eventi vicini, accessi e messaggi della regia.',
                        'Nearby events, access updates and control-room messages will appear here.',
                      ),
                    );
                  }
                  return RefreshIndicator(
                    onRefresh: () async {
                      _reload();
                      await _future;
                    },
                    color: OnePixelColors.signal,
                    child: ListView.separated(
                      padding: const EdgeInsets.only(bottom: 72),
                      physics: const AlwaysScrollableScrollPhysics(),
                      itemCount: notifications.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final notification = notifications[index];
                        final unread = notification.readAt == null;
                        final marking = _markingRead.contains(notification.id);
                        return Semantics(
                          button: unread,
                          label: unread
                              ? strings.text('Non letta', 'Unread')
                              : strings.text('Letta', 'Read'),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(22),
                            onTap: unread && !marking
                                ? () => _markRead(notification)
                                : null,
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.surface,
                                borderRadius: BorderRadius.circular(22),
                                border: Border.all(
                                  color: unread
                                      ? OnePixelColors.signal.withValues(
                                          alpha: .28,
                                        )
                                      : Theme.of(
                                          context,
                                        ).dividerColor.withValues(alpha: .12),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    decoration: BoxDecoration(
                                      color: OnePixelColors.signal.withValues(
                                        alpha: .1,
                                      ),
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                    child: marking
                                        ? const Padding(
                                            padding: EdgeInsets.all(12),
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.radar_rounded,
                                            color: OnePixelColors.signal,
                                            size: 20,
                                          ),
                                  ),
                                  const SizedBox(width: 13),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                strings.isEnglish
                                                    ? notification.titleEn
                                                    : notification.titleIt,
                                                style: const TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                            if (unread)
                                              const CircleAvatar(
                                                radius: 3,
                                                backgroundColor:
                                                    OnePixelColors.signal,
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 5),
                                        Text(
                                          strings.isEnglish
                                              ? notification.bodyEn
                                              : notification.bodyIt,
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodyMedium
                                              ?.copyWith(fontSize: 12),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          DateFormat(
                                            'dd MMM · HH:mm',
                                            strings.languageCode,
                                          ).format(
                                            notification.createdAt.toLocal(),
                                          ),
                                          style: const TextStyle(
                                            fontSize: 9,
                                            color: OnePixelColors.muted,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({
    required this.icon,
    required this.title,
    required this.body,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String body;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Center(
    child: Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(
          color: Theme.of(context).dividerColor.withValues(alpha: .12),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 34, color: OnePixelColors.signal),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 7),
          Text(
            body,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(fontSize: 12),
          ),
          if (onAction != null && actionLabel != null) ...[
            const SizedBox(height: 12),
            TextButton.icon(
              onPressed: onAction,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(actionLabel!),
            ),
          ],
        ],
      ),
    ),
  );
}
