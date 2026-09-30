export interface ComponentScore {
  componentName: string;
  value: number;
  formula: string;
  status: 'CALCULATED' | 'INSUFFICIENT_DATA' | 'NOT_RUN';
}

export interface ValidationScore {
  caseId: string;
  components: ComponentScore[];
  overallScore: number | null;
  policyVersion?: string;
  timestamp: string;
}

export class ValidationEngine {
  private scores: Map<string, ValidationScore> = new Map();

  calcularComponent(
    name: string,
    valor: number,
    formula: string
  ): ComponentScore {
    return {
      componentName: name,
      value: valor,
      formula,
      status: 'CALCULATED',
    };
  }

  registrarScore(caseId: string, components: ComponentScore[]): ValidationScore {
    const score: ValidationScore = {
      caseId,
      components,
      overallScore: null,
      timestamp: new Date().toISOString(),
    };

    // Sin política explícita, no calcular overall score
    // Solo si todos los componentes están calculados, hacer un promedio simple
    const todosCal = components.every((c) => c.status === 'CALCULATED');
    if (todosCal && components.length > 0) {
      const suma = components.reduce((acc, c) => acc + c.value, 0);
      score.overallScore = suma / components.length;
    }

    this.scores.set(caseId, score);
    return score;
  }

  obtenerScore(caseId: string): ValidationScore | undefined {
    return this.scores.get(caseId);
  }

  estado() {
    return {
      totalScores: this.scores.size,
      conOverallScore: Array.from(this.scores.values()).filter((s) => s.overallScore !== null)
        .length,
      promedio:
        Array.from(this.scores.values()).reduce((acc, s) => {
          if (s.overallScore !== null) return acc + s.overallScore;
          return acc;
        }, 0) / (this.scores.size || 1),
    };
  }
}

export const validationEngine = new ValidationEngine();
