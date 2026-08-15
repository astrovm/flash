export interface BoxedWineApplication {
  readonly id: string;
  readonly executable: string;
  readonly packagePath: string;
  readonly processExecutables: readonly string[];
}

export interface BoxedWineApplicationDefinition {
  id: string;
  executable: string;
  packagePath: string;
  processExecutables?: readonly string[];
}

export function validateBoxedWineApplications(
  definitions: readonly BoxedWineApplicationDefinition[],
): readonly BoxedWineApplication[];

export const boxedWineApplications: readonly BoxedWineApplication[];

export function getBoxedWineApplication(
  id: string,
): BoxedWineApplication | null;
