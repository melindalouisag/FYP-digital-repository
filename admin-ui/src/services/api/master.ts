import { getJson } from './http';
import { formatFacultyName } from '@/utils/facultyLabel';

export interface Faculty {
  id: number;
  code?: string | null;
  name: string;
}

export interface Program {
  id: number;
  facultyId: number;
  code?: string | null;
  name: string;
}

export const masterApi = {
  listFaculties(): Promise<Faculty[]> {
    return getJson('/api/public/master/faculties').then((items: Faculty[]) => (
      items.map((item) => ({
        ...item,
        name: formatFacultyName(item.code ?? item.name),
      }))
    ));
  },

  listPrograms(facultyId?: number): Promise<Program[]> {
    const query = facultyId ? `?facultyId=${facultyId}` : '';
    return getJson(`/api/public/master/programs${query}`);
  },
};
