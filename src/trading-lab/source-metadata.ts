export type SourceStatus = 'CURRENT' | 'HISTORICAL' | 'SUPERSEDED' | 'UNKNOWN';

export interface SourceMetadata {
  sourceId: string;
  sourceUrl?: string;
  publishedAt?: string;
  retrievedAt: string;
  validFrom?: string;
  validUntil?: string;
  supersedes?: string;
  supersededBy?: string;
  authority: 'OFFICIAL' | 'INSTITUTIONAL' | 'ACADEMIC' | 'COMMUNITY' | 'USER_PROVIDED' | 'UNKNOWN';
  status: SourceStatus;
}

export interface ConflictingEvidence {
  conflictId: string;
  entity: string;
  topic: string;
  sourceA: SourceMetadata;
  sourceB: SourceMetadata;
  statementA: string;
  statementB: string;
  createdAt: string;
  status: 'UNRESOLVED' | 'RESOLVED' | 'ACKNOWLEDGED';
  resolutionNote?: string;
}

export class SourceMetadataManager {
  private sources: Map<string, SourceMetadata> = new Map();
  private conflicts: Map<string, ConflictingEvidence> = new Map();

  registrarSource(metadata: SourceMetadata): void {
    this.sources.set(metadata.sourceId, metadata);
  }

  obtenerSource(sourceId: string): SourceMetadata | undefined {
    return this.sources.get(sourceId);
  }

  registrarConflicto(conflicto: ConflictingEvidence): void {
    this.conflicts.set(conflicto.conflictId, conflicto);
  }

  obtenerConflictos(entity: string): ConflictingEvidence[] {
    return Array.from(this.conflicts.values()).filter((c) => c.entity === entity);
  }

  marcarResuelto(conflictId: string, nota: string): void {
    const conflicto = this.conflicts.get(conflictId);
    if (conflicto) {
      conflicto.status = 'RESOLVED';
      conflicto.resolutionNote = nota;
    }
  }

  estado() {
    return {
      totalSources: this.sources.size,
      totalConflicts: this.conflicts.size,
      unresolved: Array.from(this.conflicts.values()).filter((c) => c.status === 'UNRESOLVED')
        .length,
    };
  }
}

export const sourceMetadataManager = new SourceMetadataManager();
