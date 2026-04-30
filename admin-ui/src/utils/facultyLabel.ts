export type FacultyCode = 'FET' | 'FOB' | 'FOE' | 'FAS';

type FacultyDefinition = {
  code: FacultyCode;
  label: string;
  aliases: string[];
};

const FACULTY_DEFINITIONS: FacultyDefinition[] = [
  {
    code: 'FET',
    label: 'Faculty of Engineering and Technology (FET)',
    aliases: [
      'FET',
      'FACULTY OF ENGINEERING AND TECHNOLOGY (FET)',
      'FACULTY OF ENGINEERING AND TECHNOLOGY',
      'FACULTY OF ENGINEERING & TECHNOLOGY',
    ],
  },
  {
    code: 'FOB',
    label: 'Faculty of Business (FOB)',
    aliases: [
      'FOB',
      'FACULTY OF BUSINESS (FOB)',
      'FACULTY OF BUSINESS',
      'FBS',
      'FACULTY OF BUSINESS & SOCIAL SCIENCES',
      'FACULTY OF BUSINESS AND SOCIAL SCIENCES',
    ],
  },
  {
    code: 'FOE',
    label: 'Faculty of Education (FOE)',
    aliases: [
      'FOE',
      'FACULTY OF EDUCATION (FOE)',
      'FACULTY OF EDUCATION',
      'FOE (FACULTY OF EDUCATION)',
    ],
  },
  {
    code: 'FAS',
    label: 'Faculty of Arts and Science (FAS)',
    aliases: [
      'FAS',
      'FACULTY OF ARTS AND SCIENCE (FAS)',
      'FACULTY OF ARTS AND SCIENCE',
      'FACULTY OF ARTS & SCIENCE',
      'FAS (FACULTY OF ARTS AND SCIENCE)',
    ],
  },
];

const FACULTY_BY_ALIAS = new Map<string, FacultyDefinition>(
  FACULTY_DEFINITIONS.flatMap((definition) => (
    definition.aliases.map((alias) => [alias, definition] as const)
  )),
);

export const UNIVERSITY_FACULTIES = FACULTY_DEFINITIONS.map((definition) => ({
  code: definition.code,
  label: definition.label,
}));

export function normalizeFacultyCode(value?: string | null): FacultyCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return FACULTY_BY_ALIAS.get(normalized)?.code ?? null;
}

export function formatFacultyName(value?: string | null): string {
  const code = normalizeFacultyCode(value);
  if (!code) {
    return value?.trim() || 'Not available';
  }

  return FACULTY_DEFINITIONS.find((definition) => definition.code === code)?.label
    ?? (value?.trim() || 'Not available');
}

export function getFacultyDisplayOptions() {
  return UNIVERSITY_FACULTIES;
}
