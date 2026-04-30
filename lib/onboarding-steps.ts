export type StepId =
  | "GOAL"
  | "FITNESS_HISTORY"
  | "NUTRITION"
  | "SUPPLEMENTS"
  | "HEALTH"
  | "MEDICAL_HISTORY"
  | "FORM_ANALYSIS";

export interface OnboardingStep {
  id: StepId;
  title: string;
  description: string;
  icon: string;
  optional: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "GOAL",
    title: "Your Goal",
    description: "What are you training for?",
    icon: "🎯",
    optional: false,
  },
  {
    id: "FITNESS_HISTORY",
    title: "Fitness History",
    description: "Your current fitness level",
    icon: "📊",
    optional: false,
  },
  {
    id: "NUTRITION",
    title: "Nutrition",
    description: "Foods, drinks & calorie intake",
    icon: "🥗",
    optional: false,
  },
  {
    id: "SUPPLEMENTS",
    title: "Supplements",
    description: "Any supplements you take",
    icon: "💊",
    optional: true,
  },
  {
    id: "HEALTH",
    title: "Health Conditions",
    description: "Current health status",
    icon: "❤️",
    optional: true,
  },
  {
    id: "MEDICAL_HISTORY",
    title: "Medical History",
    description: "Past injuries or conditions",
    icon: "🏥",
    optional: true,
  },
  {
    id: "FORM_ANALYSIS",
    title: "Running Form",
    description: "Video analysis of your gait",
    icon: "📹",
    optional: true,
  },
];

export interface StepData {
  step: StepId;
  data: string;
  skipped: boolean;
}
