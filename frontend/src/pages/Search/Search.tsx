import { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
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

  const results = searchMutation.data || [];

  return (
    <div className="page-container">
      <div className="mb-6">
        <h1 className="page-title">검색</h1>
        <p className="page-description">업무노트를 검색하세요</p>
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
        <Card>
          <CardHeader>
            <CardTitle>
              검색 결과 ({results.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">검색 결과가 없습니다.</p>
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
                  {results.map((result) => (
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
      )}
    </div>
  );
}
