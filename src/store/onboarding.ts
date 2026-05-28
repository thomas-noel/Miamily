import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type OpenToDiscovery = 'classic' | 'mix' | 'curious' | null
type GenerationStatus = 'idle' | 'loading' | 'success' | 'error'

interface OnboardingState {
  currentStep: number
  householdSize: number | null
  hasKids: boolean | null
  kidsAges: string[]
  cuisineStyles: string[]
  openToDiscovery: OpenToDiscovery
  allergies: string[]
  fridgeItems: string[]
  generatedRecipes: unknown[]
  generationStatus: GenerationStatus

  setCurrentStep: (step: number) => void
  setHouseholdSize: (size: number) => void
  setHasKids: (value: boolean | null) => void
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
  householdSize: null as number | null,
  hasKids: null as boolean | null,
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

      setCurrentStep:      (step)      => set({ currentStep: step }),
      setHouseholdSize:    (size)      => set({ householdSize: size }),
      setHasKids:          (value)     => set({ hasKids: value }),
      setKidsAges:         (ages)      => set({ kidsAges: ages }),
      setCuisineStyles:    (styles)    => set({ cuisineStyles: styles }),
      setOpenToDiscovery:  (mood)      => set({ openToDiscovery: mood }),
      setAllergies:        (allergies) => set({ allergies }),
      setFridgeItems:      (items)     => set({ fridgeItems: items }),
      setGeneratedRecipes: (recipes)   => set({ generatedRecipes: recipes }),
      setGenerationStatus: (status)    => set({ generationStatus: status }),
      reset:               ()          => set(INITIAL_STATE),
    }),
    {
      name: 'miamily-onboarding',
      partialize: (state) => ({
        currentStep:     state.currentStep,
        householdSize:   state.householdSize,
        hasKids:         state.hasKids,
        kidsAges:        state.kidsAges,
        cuisineStyles:   state.cuisineStyles,
        openToDiscovery: state.openToDiscovery,
        allergies:       state.allergies,
        fridgeItems:     state.fridgeItems,
      }),
    }
  )
)
