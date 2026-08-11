import 'package:flutter/widgets.dart';

class AppStrings {
  const AppStrings(this.languageCode);

  factory AppStrings.of(BuildContext context) =>
      AppStrings(Localizations.localeOf(context).languageCode);

  final String languageCode;
  bool get isEnglish => languageCode == 'en';
  String text(String italian, String english) => isEnglish ? english : italian;
}
