import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { publicRepositoryApi, type RepositoryItemSummary, type RepositorySearchParams } from '../lib/api/publicRepository';
import { masterApi, type Faculty, type Program } from '../lib/api/master';
import { joinKeywordTokens } from '../lib/keywords';
import type { PagedResponse } from '../lib/workflowTypes';

const INITIAL_FILTERS: RepositorySearchParams = {
  title: '',
  author: '',
  faculty: '',
  program: '',
  keyword: '',
};

const PAGE_SIZE = 10;

const EMPTY_PAGE: PagedResponse<RepositoryItemSummary> = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

export function useRepositorySearch() {
  const [filters, setFilters] = useState<RepositorySearchParams>(INITIAL_FILTERS);
  const [submittedFilters, setSubmittedFilters] = useState<RepositorySearchParams>(INITIAL_FILTERS);
  const [keywordTokens, setKeywordTokens] = useState<string[]>([]);
  const [pageData, setPageData] = useState<PagedResponse<RepositoryItemSummary>>(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState<number | undefined>(undefined);
  const [selectedProgramId, setSelectedProgramId] = useState<number | undefined>(undefined);
  const [masterLoadError, setMasterLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const values: number[] = [];
    for (let year = currentYear; year >= 2014; year -= 1) {
      values.push(year);
    }
    return values;
  }, []);

  const activeFilterCount = useMemo(
    () =>
      Object.values(filters).filter((value) => value !== undefined && value !== null && String(value).trim() !== '').length,
    [filters]
  );

  const load = async (params: RepositorySearchParams, requestedPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await publicRepositoryApi.search({ ...params, page: requestedPage, size: PAGE_SIZE });
      if (response.totalPages > 0 && requestedPage >= response.totalPages) {
        setPage(response.totalPages - 1);
        return;
      }
      setPageData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository data.');
      setPageData(EMPTY_PAGE);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(submittedFilters, page);
  }, [submittedFilters, page]);

  useEffect(() => {
    const joinedKeywords = joinKeywordTokens(keywordTokens);
    setFilters((prev) => (
      prev.keyword === joinedKeywords
        ? prev
        : { ...prev, keyword: joinedKeywords }
    ));
  }, [keywordTokens]);

  useEffect(() => {
    const loadFaculties = async () => {
      try {
        setMasterLoadError('');
        const data = await masterApi.listFaculties();
        setFaculties(data);
      } catch {
        setMasterLoadError('Failed to load faculty/program filters.');
      }
    };
    void loadFaculties();
  }, []);

  useEffect(() => {
    if (!selectedFacultyId) {
      setPrograms([]);
      return;
    }

    const loadPrograms = async () => {
      try {
        setMasterLoadError('');
        const data = await masterApi.listPrograms(selectedFacultyId);
        setPrograms(data);
      } catch {
        setPrograms([]);
        setMasterLoadError('Failed to load study programs for selected faculty.');
      }
    };
    void loadPrograms();
  }, [selectedFacultyId]);

  const onChange = (key: keyof RepositorySearchParams, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: key === 'year' ? (value ? Number(value) : undefined) : value,
    }));
  };

  const onFacultyChange = (value: string) => {
    if (!value) {
      setSelectedFacultyId(undefined);
      setSelectedProgramId(undefined);
      setPrograms([]);
      setFilters((prev) => ({ ...prev, faculty: '', program: '' }));
      return;
    }

    const facultyId = Number(value);
    const faculty = faculties.find((item) => item.id === facultyId);
    setSelectedFacultyId(facultyId);
    setSelectedProgramId(undefined);
    setFilters((prev) => ({
      ...prev,
      faculty: faculty?.name ?? '',
      program: '',
    }));
  };

  const onProgramChange = (value: string) => {
    if (!value) {
      setSelectedProgramId(undefined);
      setFilters((prev) => ({ ...prev, program: '' }));
      return;
    }

    const programId = Number(value);
    const program = programs.find((item) => item.id === programId);
    setSelectedProgramId(programId);
    setFilters((prev) => ({ ...prev, program: program?.name ?? '' }));
  };

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(0);
    setSubmittedFilters(filters);
  };

  const onReset = () => {
    setFilters(INITIAL_FILTERS);
    setSubmittedFilters(INITIAL_FILTERS);
    setPage(0);
    setKeywordTokens([]);
    setSelectedFacultyId(undefined);
    setSelectedProgramId(undefined);
    setPrograms([]);
  };

  const results = pageData.items;
  const pageStart = pageData.totalElements === 0 ? 0 : pageData.page * pageData.size + 1;
  const pageEnd = pageStart === 0 ? 0 : pageStart + results.length - 1;

  return {
    filters,
    keywordTokens,
    pageData,
    page,
    faculties,
    programs,
    selectedFacultyId,
    selectedProgramId,
    masterLoadError,
    loading,
    error,
    yearOptions,
    activeFilterCount,
    results,
    pageStart,
    pageEnd,
    setKeywordTokens,
    setPage,
    onChange,
    onFacultyChange,
    onProgramChange,
    onSearch,
    onReset,
  };
}
