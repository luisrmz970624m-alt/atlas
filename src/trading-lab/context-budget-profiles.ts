export type ProfileType = 'SMALL' | 'STANDARD' | 'RESEARCH';

export interface ContextBudgetProfile {
  profileType: ProfileType;
  maxNodes: number;
  maxDocuments: number;
  maxChunks: number;
  maxContextChars: number;
  description: string;
}

export interface ContextBudgetPolicy {
  policyId: string;
  version: number;
  profiles: Map<ProfileType, ContextBudgetProfile>;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PROFILES: Record<ProfileType, ContextBudgetProfile> = {
  SMALL: {
    profileType: 'SMALL',
    maxNodes: 10,
    maxDocuments: 20,
    maxChunks: 50,
    maxContextChars: 10000,
    description: 'Consultas puntuales y específicas',
  },
  STANDARD: {
    profileType: 'STANDARD',
    maxNodes: 50,
    maxDocuments: 100,
    maxChunks: 200,
    maxContextChars: 50000,
    description: 'Análisis normal de instrumento',
  },
  RESEARCH: {
    profileType: 'RESEARCH',
    maxNodes: 100,
    maxDocuments: 200,
    maxChunks: 500,
    maxContextChars: 100000,
    description: 'Investigación profunda',
  },
};

export class ContextBudgetPolicies {
  private policies: Map<string, ContextBudgetPolicy> = new Map();

  constructor() {
    const policyId = 'policy_default';
    const profiles = new Map(
      Object.entries(DEFAULT_PROFILES).map(([key, profile]) => [
        key as ProfileType,
        profile,
      ])
    );

    this.policies.set(policyId, {
      policyId,
      version: 1,
      profiles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  obtenerPerfil(profileType: ProfileType): ContextBudgetProfile {
    const policy = this.policies.get('policy_default');
    if (!policy) {
      return DEFAULT_PROFILES[profileType];
    }
    return policy.profiles.get(profileType) || DEFAULT_PROFILES[profileType];
  }

  listarPerfil(): ContextBudgetProfile[] {
    return Object.values(DEFAULT_PROFILES);
  }
}
