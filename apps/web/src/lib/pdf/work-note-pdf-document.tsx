import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatPersonBadge } from '@web/lib/utils';
import type { Todo, WorkNoteWithStats } from '@web/types/api';
import { format, parseISO } from 'date-fns';

import { MarkdownRenderer } from './markdown-renderer';
import { colors } from './styles';

/**
 * Format a date string to a human-readable format (with time)
 */
function formatDate(dateString: string): string {
  try {
    return format(parseISO(dateString), 'yyyy-MM-dd HH:mm');
  } catch {
    return dateString;
  }
}

/**
 * Format a date string to date only (no time)
 */
function formatDateOnly(dateString: string): string {
  try {
    return format(parseISO(dateString), 'yyyy-MM-dd');
  } catch {
    return dateString;
  }
}

// Register Korean font
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.0/files/noto-sans-kr-korean-400-normal.woff',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@5.0.0/files/noto-sans-kr-korean-700-normal.woff',
      fontWeight: 700,
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    backgroundColor: '#ffffff',
  },
  // Top color band
  topBand: {
    height: 6,
    backgroundColor: colors.primary,
  },
  // Main content area
  mainContent: {
    padding: 40,
    paddingTop: 30,
  },
  // Header section
  header: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: colors.gray900,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: colors.gray500,
    width: 45,
  },
  metaValue: {
    fontSize: 9,
    color: colors.gray600,
  },
  // Category badges
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: 700,
  },
  // Section card style
  section: {
    marginBottom: 20,
  },
  sectionCard: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.gray700,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Person/Assignee styles
  personItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  personBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  personName: {
    fontWeight: 700,
    color: colors.gray800,
  },
  personDept: {
    color: colors.gray500,
    fontSize: 9,
  },
  // Content section
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  content: {
    lineHeight: 1.8,
    color: colors.gray700,
    fontSize: 10,
  },
  // Todo section
  todoCard: {
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  todoItemLast: {
    borderBottomWidth: 0,
  },
  todoCheckbox: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoCheckboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  todoCheckmark: {
    fontSize: 8,
    color: '#ffffff',
    fontWeight: 700,
  },
  todoTitle: {
    flex: 1,
    color: colors.gray700,
  },
  todoTitleCompleted: {
    textDecoration: 'line-through',
    color: colors.gray400,
  },
  todoDate: {
    fontSize: 8,
    color: colors.gray500,
    backgroundColor: colors.gray100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todoDateCompleted: {
    backgroundColor: colors.successLight,
    color: colors.success,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.gray200,
    marginVertical: 16,
  },
});

interface WorkNotePDFDocumentProps {
  workNote: WorkNoteWithStats;
  todos: Todo[];
}

export function WorkNotePDFDocument({ workNote, todos }: WorkNotePDFDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top color band */}
        <View style={styles.topBand} />

        <View style={styles.mainContent}>
          {/* Header section with title, dates, and categories */}
          <View style={styles.header}>
            <Text style={styles.title}>{workNote.title}</Text>

            {/* Meta information */}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>생성일</Text>
              <Text style={styles.metaValue}>{formatDate(workNote.createdAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>수정일</Text>
              <Text style={styles.metaValue}>{formatDate(workNote.updatedAt)}</Text>
            </View>

            {/* Categories as badges */}
            {workNote.categories && workNote.categories.length > 0 && (
              <View style={styles.categoryRow}>
                {workNote.categories.map((category) => (
                  <View key={category.categoryId} style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{category.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Assignees section */}
          {workNote.persons && workNote.persons.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>담당자</Text>
                {workNote.persons.map((person) => (
                  <View key={person.personId} style={styles.personItem}>
                    <View style={styles.personBullet} />
                    <Text style={styles.personName}>
                      {formatPersonBadge({
                        name: person.personName,
                        personId: person.personId,
                        phoneExt: person.phoneExt,
                        currentDept: person.currentDept,
                        currentPosition: person.currentPosition,
                      })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Content section with markdown rendering */}
          {workNote.content && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>내용</Text>
              <View style={styles.contentCard}>
                <MarkdownRenderer content={workNote.content} />
              </View>
            </View>
          )}

          {/* Todos section */}
          {todos.length > 0 && (
            <View style={styles.section}>
              <View style={styles.todoCard}>
                <Text style={styles.sectionTitle}>할일 목록</Text>
                {todos.map((todo, index) => {
                  const isCompleted = todo.status === '완료';
                  const isLast = index === todos.length - 1;
                  // 완료된 할일: updatedAt을 완료일로 표시
                  // 미완료 할일: dueDate를 마감일로 표시
                  const displayDate = isCompleted ? todo.updatedAt : todo.dueDate;
                  const dateLabel = isCompleted ? '완료' : '마감';

                  return (
                    <View
                      key={todo.id}
                      style={isLast ? [styles.todoItem, styles.todoItemLast] : styles.todoItem}
                    >
                      <View
                        style={
                          isCompleted
                            ? [styles.todoCheckbox, styles.todoCheckboxCompleted]
                            : styles.todoCheckbox
                        }
                      >
                        {isCompleted && <Text style={styles.todoCheckmark}>✓</Text>}
                      </View>
                      <Text
                        style={
                          isCompleted
                            ? [styles.todoTitle, styles.todoTitleCompleted]
                            : styles.todoTitle
                        }
                      >
                        {todo.title}
                      </Text>
                      {displayDate && (
                        <Text
                          style={
                            isCompleted
                              ? [styles.todoDate, styles.todoDateCompleted]
                              : styles.todoDate
                          }
                        >
                          {dateLabel}: {formatDateOnly(displayDate)}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}
