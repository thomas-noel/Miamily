import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type HouseholdSize = 1 | 2 | 3 | 4 | '5+'
type OpenToDiscovery = 'classic' | 'mix' | 'curious' | null
type GenerationStatus = 'idle' | 'loading' | 'success' | 'error'

interface OnboardingState {
  currentStep: number
  householdSize: HouseholdSize
  hasKids: boolean
  kidsAges: string[]
  cuisineStyles: string[]
  openToDiscovery: OpenToDiscovery
  allergies: string[]
  fridgeItems: string[]
  generatedRecipes: unknown[]
  generationStatus: GenerationStatus

  setCurrentStep: (step: number) => void
  setHouseholdSize: (size: HouseholdSize) => void
  setHasKids: (value: boolean) => void
  setKidsAges: (ages: string[]) => void
  setCuisineStyles: (styles: string[]) => void
  setOpenToDiscovery: (mood: OpenToDiscovery) => void
  setAllergies: (allergies: string[]) => void
  setFridgeItems: (items: string[]) => void
  setGeneratedRecipes: (recipes: unknown[]) => void
  setGenerationStatus: (status: GenerationStatus) => void
  reset: () => void
}

const INITIAL_STATE = {
  currentStep: 1,
  householdSize: 2 as HouseholdSize,
  hasKids: false,
  kidsAges: [] as string[],
  cuisineStyles: [] as string[],
  openToDiscovery: null as OpenToDiscovery,
  allergies: [] as string[],
  fridgeItems: [] as string[],
  generatedRecipes: [] as unknown[],
  generationStatus: 'idle' as GenerationStatus,
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setCurrentStep:      (step)     => set({ currentStep: step }),
      setHouseholdSize:    (size)     => set({ householdSize: size }),
      setHasKids:          (value)    => set({ hasKids: value }),
      setKidsAges:         (ages)     => set({ kidsAges: ages }),
      setCuisineStyles:    (styles)   => set({ cuisineStyles: styles }),
      setOpenToDiscovery:  (mood)     => set({ openToDiscovery: mood }),
      setAllergies:        (allergies) => set({ allergies }),
      setFridgeItems:      (items)    => set({ fridgeItems: items }),
      setGeneratedRecipes: (recipes)  => set({ generatedRecipes: recipes }),
      setGenerationStatus: (status)   => set({ generationStatus: status }),
      reset:               ()         => set(INITIAL_STATE),
    }),
    {
      name: 'miamily-onboarding',
      // generatedRecipes et generationStatus ne sont pas persistés :
      // les recettes ne survivent pas au refresh, le statut se recalcule
      partialize: (state) => ({
        currentStep:      state.currentStep,
        householdSize:    state.householdSize,
        hasKids:          state.hasKids,
        kidsAges:         state.kidsAges,
        cuisineStyles:    state.cuisineStyles,
        openToDiscovery:  state.openToDiscovery,
        allergies:        state.allergies,
        fridgeItems:      state.fridgeItems,
      }),
    }
  )
)
