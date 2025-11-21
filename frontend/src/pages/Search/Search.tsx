import { useState } from 'react';
import { Search as SearchIcon, User, Building2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSearch } from '@/hooks/useSearch';

export default function Search() {
  const [query, setQuery] = useState('');
  const searchMutation = useSearch();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchMutation.mutate({ query: query.trim() });
    }
  };

  const results = searchMutation.data;
  const workNotes = results?.workNotes || [];
  const persons = results?.persons || [];
  const departments = results?.departments || [];

  const totalCount = workNotes.length + persons.length + departments.length;

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="page-title">검색</h1>
        <p className="page-description">업무노트, 사람, 부서를 검색하세요</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색어를 입력하세요"
              className="flex-1"
            />
            <Button type="submit" disabled={searchMutation.isPending}>
              <SearchIcon className="h-4 w-4 mr-2" />
              {searchMutation.isPending ? '검색 중...' : '검색'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {searchMutation.isSuccess && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="text-sm text-muted-foreground">
            총 {totalCount}개의 결과를 찾았습니다.
          </div>

          {/* Work Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                업무노트 ({workNotes.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workNotes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    검색된 업무노트가 없습니다.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제목</TableHead>
                      <TableHead>카테고리</TableHead>
                      <TableHead>점수</TableHead>
                      <TableHead>출처</TableHead>
                      <TableHead>생성일</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workNotes.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="font-medium">
                          {result.title}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{result.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={result.score > 0.8 ? 'default' : 'outline'}
                          >
                            {(result.score * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              result.source === 'lexical' ? 'outline' : 'default'
                            }
                          >
                            {{
                              semantic: '의미',
                              hybrid: '하이브리드',
                              lexical: '키워드',
                            }[result.source]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(parseISO(result.createdAt), 'yyyy-MM-dd', {
                            locale: ko,
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Persons Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                사람 ({persons.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {persons.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    검색된 사람이 없습니다.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이름</TableHead>
                      <TableHead>부서</TableHead>
                      <TableHead>직위</TableHead>
                      <TableHead>내선번호</TableHead>
                      <TableHead>재직상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {persons.map((person) => (
                      <TableRow key={person.personId}>
                        <TableCell className="font-medium">
                          {person.name}
                        </TableCell>
                        <TableCell>
                          {person.currentDept || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.currentPosition || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.phoneExt || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              person.employmentStatus === '재직'
                                ? 'default'
                                : 'secondary'
                            }
                          >
                            {person.employmentStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Departments Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                부서 ({departments.length}개)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">
                    검색된 부서가 없습니다.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>부서명</TableHead>
                      <TableHead>설명</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.deptName}>
                        <TableCell className="font-medium">
                          {dept.deptName}
                        </TableCell>
                        <TableCell>
                          {dept.description || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={dept.isActive ? 'default' : 'secondary'}
                          >
                            {dept.isActive ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
