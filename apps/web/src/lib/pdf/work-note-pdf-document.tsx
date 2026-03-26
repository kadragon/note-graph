import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatDateTimeOrFallback } from '@web/lib/date-format';
import type { Todo, WorkNoteWithStats } from '@web/types/api';

import { MarkdownRenderer } from './markdown-renderer';
import { colors } from './styles';

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
    backgroundColor: colors.white,
  },
  // Top accent bar
  topBand: {
    height: 4,
    backgroundColor: colors.primary,
  },
  // Main content area
  mainContent: {
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 50,
  },
  // Title
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 16,
  },

  // ── Metadata grid table ──
  metaTable: {
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  metaRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 28,
  },
  metaRowLast: {
    borderBottomWidth: 0,
  },
  metaKeyCell: {
    width: 72,
    backgroundColor: colors.headerBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    justifyContent: 'center',
  },
  metaKeyCellMid: {
    width: 72,
    backgroundColor: colors.headerBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    justifyContent: 'center',
  },
  metaKeyText: {
    fontSize: 9,
    fontWeight: 700,
    color: colors.textSecondary,
  },
  metaValueCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  metaValueText: {
    fontSize: 9,
    color: colors.text,
  },

  // Category badges inside metadata grid
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  categoryText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: 700,
  },

  // ── Section dividers & headers ──
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 10,
  },

  // ── Todo section ──
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoCheckboxCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  todoCheckmark: {
    fontSize: 8,
    color: colors.white,
    fontWeight: 700,
  },
  todoTitle: {
    flex: 1,
    color: colors.text,
  },
  todoTitleCompleted: {
    textDecoration: 'line-through',
    color: colors.textMuted,
  },
  todoDate: {
    fontSize: 8,
    color: colors.textSecondary,
    backgroundColor: colors.headerBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todoDateCompleted: {
    backgroundColor: colors.successBg,
    color: colors.successText,
  },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: colors.textMuted,
  },
});

interface WorkNotePDFDocumentProps {
  workNote: WorkNoteWithStats;
  todos: Todo[];
}

export function WorkNotePDFDocument({ workNote, todos }: WorkNotePDFDocumentProps) {
  const hasCategories = workNote.categories && workNote.categories.length > 0;
  const hasPersons = workNote.persons && workNote.persons.length > 0;

  // Determine which metadata row is last for border removal
  const lastRowType = hasPersons ? 'persons' : hasCategories ? 'categories' : 'dates';

  // Build persons inline text: "홍길동(개발팀) · 김영희(기획팀)"
  const personsText = workNote.persons
    ?.map((p) => {
      const orgParts = [p.currentDept, p.currentPosition].filter(Boolean);
      return orgParts.length > 0 ? `${p.personName}(${orgParts.join('/')})` : p.personName;
    })
    .join(' \u00B7 ');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top accent bar */}
        <View style={styles.topBand} />

        <View style={styles.mainContent}>
          {/* Title */}
          <Text style={styles.title}>{workNote.title}</Text>

          {/* Metadata grid table */}
          <View style={styles.metaTable}>
            {/* Row 1: 생성일 / 수정일 (4-column) */}
            <View
              style={
                lastRowType === 'dates' ? [styles.metaRow, styles.metaRowLast] : styles.metaRow
              }
            >
              <View style={styles.metaKeyCell}>
                <Text style={styles.metaKeyText}>생성일</Text>
              </View>
              <View style={styles.metaValueCell}>
                <Text style={styles.metaValueText}>
                  {formatDateTimeOrFallback(
                    workNote.createdAt,
                    'yyyy-MM-dd HH:mm',
                    workNote.createdAt
                  )}
                </Text>
              </View>
              <View style={styles.metaKeyCellMid}>
                <Text style={styles.metaKeyText}>수정일</Text>
              </View>
              <View style={styles.metaValueCell}>
                <Text style={styles.metaValueText}>
                  {formatDateTimeOrFallback(
                    workNote.updatedAt,
                    'yyyy-MM-dd HH:mm',
                    workNote.updatedAt
                  )}
                </Text>
              </View>
            </View>

            {/* Row 2: 업무구분 (categories) */}
            {hasCategories && (
              <View
                style={
                  lastRowType === 'categories'
                    ? [styles.metaRow, styles.metaRowLast]
                    : styles.metaRow
                }
              >
                <View style={styles.metaKeyCell}>
                  <Text style={styles.metaKeyText}>업무구분</Text>
                </View>
                <View style={styles.metaValueCell}>
                  <View style={styles.badgeRow}>
                    {workNote.categories!.map((category) => (
                      <View key={category.categoryId} style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{category.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Row 3: 담당자 (persons inline) */}
            {hasPersons && (
              <View style={[styles.metaRow, styles.metaRowLast]}>
                <View style={styles.metaKeyCell}>
                  <Text style={styles.metaKeyText}>담당자</Text>
                </View>
                <View style={styles.metaValueCell}>
                  <Text style={styles.metaValueText}>{personsText}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Content section */}
          {workNote.content && (
            <View>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionHeader}>내용</Text>
              <MarkdownRenderer content={workNote.content} />
            </View>
          )}

          {/* Todos section */}
          {todos.length > 0 && (
            <View>
              <View style={styles.sectionDivider} />
              <Text style={styles.sectionHeader}>할일 목록</Text>
              {todos.map((todo, index) => {
                const isCompleted = todo.status === '완료';
                const isLast = index === todos.length - 1;
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
                        {dateLabel}:{' '}
                        {formatDateTimeOrFallback(displayDate, 'yyyy-MM-dd', displayDate)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Page number footer */}
        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
