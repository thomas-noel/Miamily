export type Profile = {
  id: string
  display_name: string
  household_id: string | null
  created_at: string
}

export type Household = {
  id: string
  name: string
  created_by: string | null
  invite_code: string
  created_at: string
}

export type HouseholdMember = {
  id: string
  household_id: string
  profile_id: string
  role: 'admin' | 'member'
  joined_at: string
}

export type ProductCategory = {
  id: string
  name: string
  emoji: string
  default_expiry_days: number
  default_expiry_days_opened: number | null
  default_storage: 'fridge' | 'pantry' | 'freezer'
}

export type StorageLocation = 'fridge' | 'pantry' | 'freezer'

export type SavedRecipe = {
  id: string
  household_id: string
  created_by: string | null
  name: string
  recipe_data: Record<string, unknown>
  mode: string | null
  meal_moment: string | null
  meal_type: string | null
  status: 'saved' | 'planned' | 'cooked'
  cooked_at: string | null
  created_at: string
}

export type InventoryItem = {
  id: string
  household_id: string
  name: string
  normalized_name: string
  canonical_name: string
  category_id: string | null
  quantity: number
  unit: string
  storage_location: StorageLocation
  expiry_date: string | null
  estimated_expiry_date: string
  is_expiry_estimated: boolean
  opened_at: string | null
  added_by: string | null
  source: 'manual' | 'photo' | 'screenshot' | 'paste'
  created_at: string
  updated_at: string
  product_categories?: ProductCategory | null
}
