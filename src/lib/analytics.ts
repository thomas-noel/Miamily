// No-op analytics wrapper — provider à brancher post-bêta.
// Signature stable : tout le code onboarding l'importe depuis ici.
// Pour brancher PostHog ou Mixpanel : implémenter le corps de track() uniquement.

type OnboardingEvent =
  | { name: 'onboarding_started' }
  | { name: 'onboarding_screen_viewed'; screen: 1|2|3|4|5|6|7 }
  | { name: 'household_size_selected'; size: number }
  | { name: 'kids_yes_no'; value: 'yes'|'no' }
  | { name: 'kids_age_selected'; age: string }
  | { name: 'cuisine_style_selected'; count: number }
  | { name: 'more_options_clicked' }
  | { name: 'mood_selected'; value: 'classic'|'mix'|'curious' }
  | { name: 'allergies_kept_default' }
  | { name: 'allergies_modified'; allergies: string[] }
  | { name: 'fridge_screen_viewed' }
  | { name: 'fridge_item_toggled'; item: string; on: boolean }
  | { name: 'fridge_paste_list_clicked' }
  | { name: 'fridge_skip_clicked' }
  | { name: 'fridge_continued'; count: number }
  | { name: 'pregen_viewed' }
  | { name: 'pregen_edit_clicked' }
  | { name: 'generation_started' }
  | { name: 'loading_completed'; duration_ms: number }
  | { name: 'loading_error'; reason: string }
  | { name: 'onboarding_completed'; time_to_first_recipe_ms: number; recipes_count: number }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function track(_event: OnboardingEvent): void {
  // no-op
}
