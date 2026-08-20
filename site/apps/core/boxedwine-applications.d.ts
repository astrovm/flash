export interface BoxedWineApplication {
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly executable: string;
  readonly packagePath: string;
}

export interface BoxedWineApplicationDefinition {
  id: string;
  title: string;
  icon: string;
  executable: string;
  packagePath: string;
}

export function validateBoxedWineApplications(
  definitions: readonly BoxedWineApplicationDefinition[],
): readonly BoxedWineApplication[];

export const boxedWineApplications: readonly BoxedWineApplication[];

export function getBoxedWineApplication(
  id: string,
): BoxedWineApplication | null;
